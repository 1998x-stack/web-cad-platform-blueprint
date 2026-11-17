"""SQLite-only P1 catalog hardening reference service (not an HTTP/auth service).

Uses v1+v2 migrations, computes immutable release manifests and supports bounded
CJK substring fallback alongside FTS5 for Latin; production needs API ACL.
"""
from __future__ import annotations
import hashlib
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def connect(path=':memory:') -> sqlite3.Connection:
    db=sqlite3.connect(path)
    db.execute('PRAGMA foreign_keys=ON')
    if not db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").fetchone():
        db.executescript((ROOT/'migrations/001_init.sql').read_text())
    applied={v for (v,) in db.execute('SELECT version FROM schema_migrations')}
    if 2 not in applied:
        db.executescript((ROOT/'migrations/002_immutable_publications.sql').read_text())
    return db


def manifest_for_release(db: sqlite3.Connection, release_id:int) -> tuple[str,str]:
    release=db.execute('SELECT listing_id,version,license_snapshot,state FROM model_releases WHERE id=?',(release_id,)).fetchone()
    if release is None:raise ValueError('RELEASE_NOT_FOUND')
    assets=db.execute('''SELECT r.role,a.sha256,a.byte_size,a.format FROM release_assets r
      JOIN assets a ON a.id=r.asset_id WHERE r.release_id=? ORDER BY r.role,a.sha256''',(release_id,)).fetchall()
    if not assets or not any(a[0]=='source' for a in assets):raise ValueError('SOURCE_ASSET_REQUIRED')
    if db.execute('''SELECT COUNT(*) FROM release_assets r JOIN assets a ON a.id=r.asset_id
      WHERE r.release_id=? AND a.verification_status!='valid' ''',(release_id,)).fetchone()[0]:
        raise ValueError('INVALID_ASSET')
    manifest={'listingId':release[0],'version':release[1],'license':release[2],
              'assets':[{'role':a[0],'sha256':a[1],'bytes':a[2],'format':a[3]} for a in assets]}
    serialized=json.dumps(manifest,sort_keys=True,separators=(',',':'),ensure_ascii=False)
    return hashlib.sha256(serialized.encode()).hexdigest(),serialized


def publish_release(db:sqlite3.Connection, release_id:int)->str:
    """Atomic publish with manifest SHA; checked SQL triggers protect postpublish.
    Do not allow public user input as release_id without server ACL checks.
    """
    db.execute('SAVEPOINT publish_release')
    try:
        row=db.execute('SELECT state FROM model_releases WHERE id=?',(release_id,)).fetchone()
        if row is None or row[0]!='staging':raise ValueError('RELEASE_NOT_STAGING')
        digest,_=manifest_for_release(db,release_id)
        db.execute("UPDATE model_releases SET manifest_sha256=?,state='published' WHERE id=? AND state='staging'",(digest,release_id))
        db.execute('RELEASE SAVEPOINT publish_release')
        return digest
    except BaseException:
        db.execute('ROLLBACK TO SAVEPOINT publish_release');db.execute('RELEASE SAVEPOINT publish_release')
        raise


def search_public_listings(db: sqlite3.Connection, query: str, limit:int=50):
    """Safe bounded query: CJK substring fallback; Latin FTS5 MATCH escape.
    10k records smoke benchmark required; this is NOT a scalable tokenizer.
    Only public+published listings; API auth for private/unlisted is separate.
    """
    if not isinstance(query,str) or not 1<=len(query.strip())<=80 or not 1<=limit<=100:
        raise ValueError('INVALID_SEARCH')
    query=query.strip()
    if re.search(r'[\u3400-\u9fff]',query):
        return db.execute('''SELECT public_id,title FROM model_listings WHERE
          visibility='public' AND status='published' AND
          (instr(title,?)>0 OR instr(description,?)>0 OR instr(category,?)>0)
          ORDER BY id DESC LIMIT ?''',(query,query,query,limit)).fetchall()
    # User input is an FTS *literal*; no raw MATCH grammar from callers.
    literal='"'+query.replace('"','""')+'"'
    return db.execute('''SELECT l.public_id,l.title FROM model_listings_fts f
      JOIN model_listings l ON l.id=f.rowid WHERE model_listings_fts MATCH ?
      AND l.visibility='public' AND l.status='published' ORDER BY l.id DESC LIMIT ?''', (literal,limit)).fetchall()

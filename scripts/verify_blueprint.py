#!/usr/bin/env python3
"""Offline document links, JSON and SQLite smoke test. Not geometry evidence."""
import json
import re
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_markdown_links():
    issues = []
    for md in ROOT.rglob('*.md'):
        text = md.read_text(encoding='utf-8')
        for uri in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)', text):
            path = uri.split('#', 1)[0]
            if not path or path.startswith(('http://', 'https://', 'mailto:')):
                continue
            if not (md.parent / path).exists():
                issues.append(f'{md.relative_to(ROOT)} -> {uri}')
    if issues:
        raise AssertionError('Missing local links:\n' + '\n'.join(issues))
    return len(list(ROOT.rglob('*.md')))


def check_json():
    names = []
    for p in ROOT.rglob('*.json'):
        json.loads(p.read_text(encoding='utf-8'))
        names.append(str(p.relative_to(ROOT)))
    return names


def check_sql():
    db = sqlite3.connect(':memory:')
    db.execute('PRAGMA foreign_keys=ON')
    db.executescript((ROOT / 'packages/cad-store/migrations/001_init.sql').read_text(encoding='utf-8'))
    db.execute("INSERT INTO users(public_id,display_name) VALUES('u_test','Tester')")
    db.execute("""INSERT INTO model_listings(public_id,slug,author_user_id,title,description,visibility,status)
                  VALUES('m_test','test-chair',1,'Oak Chair','wood furniture','public','published')""")
    rows = db.execute("""SELECT l.slug FROM model_listings_fts f
                         JOIN model_listings l ON l.id=f.rowid
                         WHERE model_listings_fts MATCH 'chair' AND l.visibility='public'""").fetchall()
    assert rows == [('test-chair',)], rows
    db.execute("UPDATE model_listings SET title='Stool' WHERE id=1")
    assert db.execute("SELECT count(*) FROM model_listings_fts WHERE model_listings_fts MATCH 'chair'").fetchone()[0] == 0
    assert db.execute("SELECT count(*) FROM model_listings_fts WHERE model_listings_fts MATCH 'stool'").fetchone()[0] == 1
    db.execute("INSERT INTO projects(public_id,owner_user_id,title) VALUES('p_test',1,'test')")
    db.execute("INSERT INTO documents(public_id,project_id,title) VALUES('d_test',1,'test')")
    db.execute("""INSERT INTO model_releases(listing_id,version,source_document_id,source_revision,manifest_sha256,license_snapshot)
                  VALUES(1,'1.0.0',1,0,?, 'CC0')""", ('a' * 64,))
    try:
        db.execute("UPDATE model_releases SET version='1.0.1' WHERE id=1")
    except sqlite3.DatabaseError:
        pass
    else:
        raise AssertionError('immutable release UPDATE was accepted')
    try:
        db.execute("INSERT INTO documents(public_id,project_id,title) VALUES('bad',999,'invalid')")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('foreign key violation was accepted')
    # v2 must upgrade a v1 database *without weakening old published release history*.
    db.executescript((ROOT / 'packages/cad-store/migrations/002_immutable_publications.sql').read_text(encoding='utf-8'))
    assert db.execute('SELECT state FROM model_releases WHERE id=1').fetchone()[0] == 'published'
    try:
        db.execute("INSERT INTO release_assets(release_id,asset_id,role) VALUES(1,1,'source')")
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('published v1 release membership was mutable after v2 upgrade')
    assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    return db.execute("SELECT version FROM schema_migrations").fetchall()


if __name__ == '__main__':
    print(f'Markdown files verified: {check_markdown_links()}')
    print(f'JSON files verified: {len(check_json())}')
    print(f'SQLite migration verified: {check_sql()}')
    print('PASS: docs / JSON / SQLite metadata integrity (not CAD geometry)')

#!/usr/bin/env python3
"""Non-gating 10k CJK/Latin catalog benchmark with fixed synthetic data.
Not a production benchmark; printing machine information makes it auditable.
"""
import json
import platform
import sqlite3
import statistics
import sys
import time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'packages/cad-store/src'))
from catalog import connect, search_public_listings

def main():
    db=connect()
    db.execute("INSERT INTO users(public_id,display_name) VALUES('owner','User')")
    db.executemany("""INSERT INTO model_listings(public_id,slug,author_user_id,title,visibility,status)
     VALUES(?,?,1,?,'public','published')""",
      ((f'm{i}',f'model-{i}',('参数化机械零件' if i%23==0 else f'Steel Bracket {i}')) for i in range(10000)))
    db.commit()
    samples={}
    for term in ('机械','参数化','Bracket'):
        for _ in range(10):search_public_listings(db,term)
        times=[]
        for _ in range(75):
            t=time.perf_counter();search_public_listings(db,term);times.append((time.perf_counter()-t)*1000)
        samples[term]={'p50Ms':round(statistics.median(times),3),'p95Ms':round(sorted(times)[int(len(times)*0.95)],3),'results':len(search_public_listings(db,term))}
    result={'dataset':'synthetic-10000','sqliteVersion':sqlite3.sqlite_version,'platform':platform.platform(),'python':platform.python_version(),'queries':samples}
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()

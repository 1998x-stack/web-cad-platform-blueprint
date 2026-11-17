"""P1 v2 migration and search regressions; standalone SQLite, no HTTP ACL claims."""
import hashlib
import tempfile
import sqlite3
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'src'))
from catalog import connect, publish_release, search_public_listings

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.db=connect()
        self.db.execute("INSERT INTO users(public_id,display_name) VALUES('u','Tester')")
        self.db.execute("""INSERT INTO model_listings(public_id,slug,author_user_id,title,visibility,status)
          VALUES('m','cn-part',1,'参数化机械零件','public','published')""")
        self.db.execute("""INSERT INTO assets(sha256,object_key,byte_size,format,mime_type,verification_status)
          VALUES(?,?,?,?,?,?)""",('a'*64,'sha256/a',123,'STEP','model/step','valid'))
        self.db.execute("""INSERT INTO model_releases(listing_id,version,manifest_sha256,license_snapshot,state)
          VALUES(1,'1.0.0',?,?,'staging')""",('0'*64,'CC0'))
        self.db.execute("INSERT INTO release_assets(release_id,asset_id,role) VALUES(1,1,'source')")
    def tearDown(self):self.db.close()
    def test_immutable_release_assets_and_asset_after_publish(self):
        digest=publish_release(self.db,1)
        self.assertEqual(len(digest),64)
        for sql in ["DELETE FROM release_assets WHERE release_id=1", "UPDATE release_assets SET role='export' WHERE release_id=1",
                    "INSERT INTO release_assets(release_id,asset_id,role) VALUES(1,1,'thumbnail')",
                    "UPDATE assets SET object_key='changed' WHERE id=1", "DELETE FROM assets WHERE id=1",
                    "UPDATE model_releases SET version='1.0.1' WHERE id=1", "DELETE FROM model_releases WHERE id=1"]:
            with self.subTest(sql=sql),self.assertRaises(sqlite3.IntegrityError):self.db.execute(sql)
    def test_unverified_release_cannot_publish_and_new_version_works(self):
        self.db.execute("UPDATE assets SET verification_status='invalid' WHERE id=1")
        with self.assertRaises(ValueError):publish_release(self.db,1)
        self.assertEqual(self.db.execute('SELECT state FROM model_releases').fetchone()[0],'staging')
        self.db.execute("UPDATE assets SET verification_status='valid' WHERE id=1")
        publish_release(self.db,1)
        self.db.execute("INSERT INTO model_releases(listing_id,version,manifest_sha256,license_snapshot,state) VALUES(1,'1.0.1',?,'CC0','staging')",('0'*64,))
        self.db.execute("INSERT INTO release_assets(release_id,asset_id,role) VALUES(2,1,'source')")
        self.assertEqual(len(publish_release(self.db,2)),64)
    def test_published_direct_insert_is_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("INSERT INTO model_releases(listing_id,version,manifest_sha256,license_snapshot) VALUES(1,'2.0.0',?,'CC0')",('a'*64,))
    def test_chinese_partial_and_latin_search(self):
        self.assertEqual(search_public_listings(self.db,'机械'),[('m','参数化机械零件')])
        self.assertEqual(search_public_listings(self.db,'参数化'),[('m','参数化机械零件')])
        self.db.execute("UPDATE model_listings SET title='Steel Bracket' WHERE id=1")
        self.assertEqual(search_public_listings(self.db,'bracket'),[('m','Steel Bracket')])
        self.db.execute("UPDATE model_listings SET visibility='private' WHERE id=1")
        self.assertEqual(search_public_listings(self.db,'bracket'),[])
    def test_migration_is_idempotent_on_persistent_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            location=str(Path(tmp)/'models.sqlite')
            first=connect(location)
            self.assertEqual(first.execute('SELECT count(*) FROM schema_migrations').fetchone()[0],2)
            first.close()
            second=connect(location)
            self.assertEqual(second.execute('SELECT count(*) FROM schema_migrations').fetchone()[0],2)
            second.close()
    def test_safe_search_metacharacters(self):
        for q in ['a*','\" OR public_id:*','a OR b']:
            search_public_listings(self.db,q)

if __name__=='__main__':unittest.main()

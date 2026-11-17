-- P1 hardening: post-publication assets and relationships are immutable.
-- Existing v1 releases are migrated as published. New releases MUST be staged.
PRAGMA foreign_keys = ON;
BEGIN;
ALTER TABLE model_releases ADD COLUMN state TEXT NOT NULL DEFAULT 'published'
  CHECK (state IN ('staging','published'));
DROP TRIGGER IF EXISTS model_releases_no_update;
DROP TRIGGER IF EXISTS model_releases_no_delete;

CREATE TRIGGER model_releases_require_staging BEFORE INSERT ON model_releases
WHEN NEW.state != 'staging'
BEGIN SELECT RAISE(ABORT,'new release must start in staging'); END;

CREATE TRIGGER model_releases_no_update BEFORE UPDATE ON model_releases
WHEN OLD.state = 'published'
BEGIN SELECT RAISE(ABORT,'published releases are immutable'); END;

CREATE TRIGGER model_releases_no_delete BEFORE DELETE ON model_releases
BEGIN SELECT RAISE(ABORT,'release history cannot be deleted'); END;

CREATE TRIGGER model_releases_require_verified_assets BEFORE UPDATE OF state ON model_releases
WHEN OLD.state='staging' AND NEW.state='published'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM release_assets WHERE release_id=OLD.id AND role='source'
  ) THEN RAISE(ABORT,'published release requires source asset') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM release_assets r JOIN assets a ON a.id=r.asset_id
    WHERE r.release_id=OLD.id AND a.verification_status != 'valid'
  ) THEN RAISE(ABORT,'published release assets must be valid') END;
  SELECT CASE WHEN NEW.manifest_sha256=lower(hex(zeroblob(32)))
    THEN RAISE(ABORT,'published release requires manifest hash') END;
END;

CREATE TRIGGER release_assets_no_insert BEFORE INSERT ON release_assets
WHEN EXISTS (SELECT 1 FROM model_releases WHERE id=NEW.release_id AND state='published')
BEGIN SELECT RAISE(ABORT,'published asset membership immutable'); END;
CREATE TRIGGER release_assets_no_update BEFORE UPDATE ON release_assets
WHEN EXISTS (SELECT 1 FROM model_releases WHERE id=OLD.release_id AND state='published')
  OR EXISTS (SELECT 1 FROM model_releases WHERE id=NEW.release_id AND state='published')
BEGIN SELECT RAISE(ABORT,'published asset membership immutable'); END;
CREATE TRIGGER release_assets_no_delete BEFORE DELETE ON release_assets
WHEN EXISTS (SELECT 1 FROM model_releases WHERE id=OLD.release_id AND state='published')
BEGIN SELECT RAISE(ABORT,'published asset membership immutable'); END;

CREATE TRIGGER assets_no_mutation_in_published_release BEFORE UPDATE ON assets
WHEN EXISTS (SELECT 1 FROM release_assets r JOIN model_releases m ON m.id=r.release_id
             WHERE r.asset_id=OLD.id AND m.state='published')
BEGIN SELECT RAISE(ABORT,'published asset immutable'); END;
CREATE TRIGGER assets_no_delete_in_published_release BEFORE DELETE ON assets
WHEN EXISTS (SELECT 1 FROM release_assets r JOIN model_releases m ON m.id=r.release_id
             WHERE r.asset_id=OLD.id AND m.state='published')
BEGIN SELECT RAISE(ABORT,'published asset immutable'); END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES(2);
COMMIT;

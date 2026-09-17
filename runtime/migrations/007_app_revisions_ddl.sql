PRAGMA foreign_keys = ON;

ALTER TABLE business_app_revisions ADD COLUMN ddl_applied_json TEXT;
ALTER TABLE business_app_revisions ADD COLUMN materialize_status TEXT NOT NULL DEFAULT 'pending';

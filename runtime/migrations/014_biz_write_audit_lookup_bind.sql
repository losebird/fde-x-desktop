PRAGMA foreign_keys = ON;

ALTER TABLE biz_write_audit ADD COLUMN lookup_bind_json TEXT NOT NULL DEFAULT '{}';

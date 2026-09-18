PRAGMA foreign_keys = ON;

ALTER TABLE biz_write_audit ADD COLUMN rollback_state TEXT NOT NULL DEFAULT 'none';

PRAGMA foreign_keys = ON;

ALTER TABLE business_apps ADD COLUMN deleted_at TEXT;

UPDATE business_apps
SET deleted_at = updated_at,
    status = 'active'
WHERE status = 'archived'
  AND (deleted_at IS NULL OR deleted_at = '');

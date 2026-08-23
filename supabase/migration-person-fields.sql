-- Migration: Add person_age and person_sex columns for person/child declarations
-- Run AFTER migration-support-messages.sql

-- Add person_age column (text to store "8 ans", "30-35 ans", etc.)
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS person_age text;

-- Add person_sex column (M/F)
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS person_sex text;

-- Index for filtering by sex
CREATE INDEX IF NOT EXISTS idx_declarations_person_sex ON declarations(person_sex);

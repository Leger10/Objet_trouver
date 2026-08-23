-- Add document detection columns to declarations table
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS is_document_photo BOOLEAN DEFAULT false;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS doc_photo_type TEXT DEFAULT '';

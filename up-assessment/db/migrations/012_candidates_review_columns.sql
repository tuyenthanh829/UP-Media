-- Add review tracking columns to import_question_candidates
ALTER TABLE private.import_question_candidates
  ADD COLUMN IF NOT EXISTS reviewed_by  uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz;

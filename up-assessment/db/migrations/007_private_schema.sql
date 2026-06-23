-- ============================================================
-- Migration 007: private schema — import, sync, audit
-- ============================================================

-- ============================================================
-- private.import_jobs
-- ============================================================
CREATE TABLE private.import_jobs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform          text NOT NULL DEFAULT 'notebooklm',
  source_url               text,
  source_title             text,
  initiated_by             uuid NOT NULL REFERENCES app.profiles(id),
  parser_version           varchar(50) NOT NULL,
  status                   import_status NOT NULL DEFAULT 'received',
  total_questions_detected integer,
  error_summary            text,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_import_jobs_updated_at
  BEFORE UPDATE ON private.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- private.import_question_candidates
-- ============================================================
CREATE TABLE private.import_question_candidates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id        uuid NOT NULL REFERENCES private.import_jobs(id),
  raw_question_payload jsonb NOT NULL,
  parsed_stem          text,
  parsed_options       jsonb,
  parsed_correct_answer jsonb,
  parsed_explanation   text,
  confidence_score     numeric(5,2),
  validation_status    candidate_validation_status NOT NULL DEFAULT 'valid',
  review_status        candidate_review_status NOT NULL DEFAULT 'pending',
  notion_page_id       text,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- private.notion_sync_logs
-- ============================================================
CREATE TABLE private.notion_sync_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text NOT NULL,
  question_id    uuid REFERENCES content.questions(id),
  sync_direction sync_direction NOT NULL,
  sync_status    sync_status NOT NULL,
  source_version text,
  target_version integer,
  error_detail   text,
  synced_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_notion_page ON private.notion_sync_logs(notion_page_id);

-- ============================================================
-- private.audit_events — append-only ledger
-- ============================================================
CREATE TABLE private.audit_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id       uuid REFERENCES app.profiles(id),
  actor_role_snapshot jsonb,
  action_type         text NOT NULL,
  entity_type         text NOT NULL,
  entity_id           uuid NOT NULL,
  old_data            jsonb,
  new_data            jsonb,
  reason              text,
  request_id          text,
  occurred_at         timestamptz NOT NULL DEFAULT NOW(),
  previous_event_hash text,
  event_hash          text
);

CREATE INDEX idx_audit_events_entity ON private.audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_events_actor ON private.audit_events(actor_user_id);
CREATE INDEX idx_audit_events_occurred_at ON private.audit_events(occurred_at DESC);

-- Prevent deletion of audit records
CREATE OR REPLACE RULE audit_events_no_delete AS
  ON DELETE TO private.audit_events DO INSTEAD NOTHING;

-- ============================================================
-- Audit helper function
-- ============================================================
CREATE OR REPLACE FUNCTION private.log_audit_event(
  p_actor_user_id       uuid,
  p_actor_role_snapshot jsonb,
  p_action_type         text,
  p_entity_type         text,
  p_entity_id           uuid,
  p_old_data            jsonb DEFAULT NULL,
  p_new_data            jsonb DEFAULT NULL,
  p_reason              text DEFAULT NULL,
  p_request_id          text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO private.audit_events (
    id, actor_user_id, actor_role_snapshot,
    action_type, entity_type, entity_id,
    old_data, new_data, reason, request_id
  ) VALUES (
    v_id, p_actor_user_id, p_actor_role_snapshot,
    p_action_type, p_entity_type, p_entity_id,
    p_old_data, p_new_data, p_reason, p_request_id
  );
  RETURN v_id;
END;
$$;

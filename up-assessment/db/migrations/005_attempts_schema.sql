-- ============================================================
-- Migration 005: attempts, answers, grading, topic scores
-- ============================================================

-- ============================================================
-- assessment.attempts
-- ============================================================
CREATE TABLE assessment.attempts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_recipient_id uuid NOT NULL REFERENCES assessment.assignment_recipients(id),
  user_id                 uuid NOT NULL REFERENCES app.profiles(id),  -- denormalized for RLS
  attempt_no              smallint NOT NULL,
  attempt_mode            attempt_mode NOT NULL DEFAULT 'official',
  status                  attempt_status NOT NULL DEFAULT 'not_started',
  started_at              timestamptz,
  submitted_at            timestamptz,
  expires_at              timestamptz NOT NULL,
  duration_seconds        integer,
  score                   numeric(5,2),
  total_score             numeric(7,2) NOT NULL DEFAULT 100.00,
  pass_status             pass_status NOT NULL DEFAULT 'pending',
  is_valid_for_kpi        boolean NOT NULL DEFAULT false,
  invalid_reason          text,
  submitted_ip_hash       text,
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_attempt_no UNIQUE (assignment_recipient_id, attempt_no)
);

CREATE TRIGGER trg_attempts_updated_at
  BEFORE UPDATE ON assessment.attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add FK from assignment_recipients to first_valid_attempt
ALTER TABLE assessment.assignment_recipients
  ADD CONSTRAINT fk_first_valid_attempt
  FOREIGN KEY (first_valid_attempt_id) REFERENCES assessment.attempts(id);

-- ============================================================
-- assessment.attempt_items — immutable exam snapshot
-- ============================================================
CREATE TABLE assessment.attempt_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id              uuid NOT NULL REFERENCES assessment.attempts(id),
  question_version_id     uuid NOT NULL REFERENCES content.question_versions(id),
  question_stem_snapshot  text NOT NULL,
  question_type_snapshot  question_type NOT NULL,
  -- options_snapshot: [{option_id, display_order, option_text}] — NO is_correct
  options_snapshot        jsonb NOT NULL,
  -- topic_snapshot: [{topic_id, topic_name}]
  topic_snapshot          jsonb NOT NULL,
  display_order           smallint NOT NULL,
  score_weight            numeric(7,2) NOT NULL,
  is_required             boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attempt_items_attempt ON assessment.attempt_items(attempt_id);

-- ============================================================
-- private.attempt_answer_keys — grading only, never to browser
-- ============================================================
CREATE TABLE private.attempt_answer_keys (
  attempt_item_id      uuid PRIMARY KEY REFERENCES assessment.attempt_items(id),
  correct_option_ids   jsonb NOT NULL,  -- array of option UUIDs
  grading_rule_snapshot jsonb NOT NULL DEFAULT '{"rule": "exact_match"}',
  created_at           timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- assessment.attempt_answers
-- ============================================================
CREATE TABLE assessment.attempt_answers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_item_id     uuid NOT NULL REFERENCES assessment.attempt_items(id),
  selected_option_ids jsonb NOT NULL DEFAULT '[]',
  is_final            boolean NOT NULL DEFAULT false,
  saved_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_answer_per_item UNIQUE (attempt_item_id)
);

-- Prevent modifying finalized answers (after submission)
CREATE OR REPLACE FUNCTION assessment.prevent_mutation_of_submitted_attempt()
RETURNS TRIGGER AS $$
DECLARE
  attempt_rec assessment.attempts%ROWTYPE;
BEGIN
  SELECT a.* INTO attempt_rec
  FROM assessment.attempts a
  JOIN assessment.attempt_items ai ON ai.attempt_id = a.id
  WHERE ai.id = NEW.attempt_item_id;

  IF attempt_rec.status = 'submitted' OR attempt_rec.status = 'expired' THEN
    RAISE EXCEPTION 'Cannot modify answers for a submitted or expired attempt.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_answer_mutation
  BEFORE UPDATE ON assessment.attempt_answers
  FOR EACH ROW EXECUTE FUNCTION assessment.prevent_mutation_of_submitted_attempt();

-- ============================================================
-- assessment.attempt_topic_scores
-- ============================================================
CREATE TABLE assessment.attempt_topic_scores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       uuid NOT NULL REFERENCES assessment.attempts(id),
  topic_id         uuid NOT NULL REFERENCES content.topics(id),
  questions_count  integer NOT NULL,
  correct_count    integer NOT NULL,
  max_score        numeric(7,2) NOT NULL,
  earned_score     numeric(7,2) NOT NULL,
  accuracy_percent numeric(5,2) NOT NULL,
  insight_status   topic_insight_status NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_topic_score_per_attempt UNIQUE (attempt_id, topic_id)
);

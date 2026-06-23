-- ============================================================
-- Migration 003: content schema — courses, topics, questions
-- ============================================================

-- ============================================================
-- content.courses
-- ============================================================
CREATE TABLE content.courses (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code          varchar(50) UNIQUE NOT NULL,
  name                 text NOT NULL,
  description          text,
  owner_id             uuid REFERENCES app.profiles(id),
  status               course_status NOT NULL DEFAULT 'draft',
  passing_score_default numeric(5,2) NOT NULL DEFAULT 80.00,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON content.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- content.topics
-- ============================================================
CREATE TABLE content.topics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid NOT NULL REFERENCES content.courses(id),
  parent_topic_id uuid REFERENCES content.topics(id),
  code            varchar(80) NOT NULL,
  name            text NOT NULL,
  description     text,
  status          entity_status NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_topic_code_per_course UNIQUE (course_id, code)
);

-- ============================================================
-- content.questions — stable identity across versions
-- ============================================================
CREATE TABLE content.questions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_code    varchar(80) UNIQUE NOT NULL,
  course_id        uuid NOT NULL REFERENCES content.courses(id),
  source_type      question_source_type NOT NULL,
  notion_page_id   text,
  status           question_status NOT NULL DEFAULT 'draft',
  current_version_no integer NOT NULL DEFAULT 1,
  created_by       uuid REFERENCES app.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  retired_at       timestamptz
);

-- ============================================================
-- content.question_versions — immutable content versions
-- ============================================================
CREATE TABLE content.question_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL REFERENCES content.questions(id),
  version_no       integer NOT NULL,
  question_type    question_type NOT NULL,
  stem             text NOT NULL,
  explanation      text,
  difficulty       difficulty_level NOT NULL DEFAULT 'medium',
  language_code    varchar(10) NOT NULL DEFAULT 'vi-VN',
  source_reference text,
  content_hash     text,
  review_status    review_status NOT NULL DEFAULT 'draft',
  reviewed_by      uuid REFERENCES app.profiles(id),
  reviewed_at      timestamptz,
  published_at     timestamptz,
  created_by       uuid REFERENCES app.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_question_version UNIQUE (question_id, version_no)
);

-- Prevent editing a published question version in place
CREATE OR REPLACE FUNCTION content.prevent_edit_of_published_question_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.review_status = 'published' THEN
    RAISE EXCEPTION 'Cannot edit a published question version. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_published_qv_edit
  BEFORE UPDATE ON content.question_versions
  FOR EACH ROW EXECUTE FUNCTION content.prevent_edit_of_published_question_version();

-- ============================================================
-- content.question_options
-- ============================================================
CREATE TABLE content.question_options (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_version_id uuid NOT NULL REFERENCES content.question_versions(id) ON DELETE CASCADE,
  canonical_key       varchar(5) NOT NULL,  -- A/B/C/D
  option_text         text NOT NULL,
  is_correct          boolean NOT NULL,     -- NEVER sent to browser
  canonical_order     smallint NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_option_key_per_version UNIQUE (question_version_id, canonical_key)
);

-- Enforce correct answer count rules
CREATE OR REPLACE FUNCTION content.enforce_question_correct_answer_count()
RETURNS TRIGGER AS $$
DECLARE
  q_type question_type;
  correct_count integer;
  total_count integer;
BEGIN
  SELECT qv.question_type INTO q_type
  FROM content.question_versions qv
  WHERE qv.id = NEW.question_version_id;

  SELECT COUNT(*) INTO correct_count
  FROM content.question_options
  WHERE question_version_id = NEW.question_version_id AND is_correct = true;

  SELECT COUNT(*) INTO total_count
  FROM content.question_options
  WHERE question_version_id = NEW.question_version_id;

  IF q_type = 'single_choice' AND correct_count > 1 THEN
    RAISE EXCEPTION 'single_choice questions must have exactly 1 correct option';
  END IF;

  IF q_type = 'true_false' AND total_count > 2 THEN
    RAISE EXCEPTION 'true_false questions must have exactly 2 options';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_correct_answer_count
  AFTER INSERT OR UPDATE ON content.question_options
  FOR EACH ROW EXECUTE FUNCTION content.enforce_question_correct_answer_count();

-- ============================================================
-- content.question_topics
-- ============================================================
CREATE TABLE content.question_topics (
  question_version_id uuid NOT NULL REFERENCES content.question_versions(id) ON DELETE CASCADE,
  topic_id            uuid NOT NULL REFERENCES content.topics(id),
  weight              numeric(5,2) NOT NULL DEFAULT 1.00,
  is_primary_topic    boolean NOT NULL DEFAULT false,

  PRIMARY KEY (question_version_id, topic_id)
);

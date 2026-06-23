-- ============================================================
-- Migration 004: assessment schema — policies, templates, assignments
-- ============================================================

-- ============================================================
-- assessment.assessment_policies
-- ============================================================
CREATE TABLE assessment.assessment_policies (
  id                               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_code                      varchar(80) UNIQUE NOT NULL,
  policy_name                      text NOT NULL,
  assessment_class                 assessment_class NOT NULL,
  score_rule                       score_rule NOT NULL,
  passing_score                    numeric(5,2) NOT NULL,
  attempt_limit_official           smallint NOT NULL DEFAULT 1,
  allow_practice_retake            boolean NOT NULL DEFAULT true,
  feedback_mode                    feedback_mode NOT NULL DEFAULT 'after_close',
  show_score_immediately           boolean NOT NULL DEFAULT true,
  show_pass_fail_immediately       boolean NOT NULL DEFAULT true,
  show_topic_feedback_immediately  boolean NOT NULL DEFAULT true,
  show_correct_answers_immediately boolean NOT NULL DEFAULT false,
  show_explanations_immediately    boolean NOT NULL DEFAULT false,
  weak_topic_threshold             numeric(5,2) NOT NULL DEFAULT 70.00,
  min_questions_for_topic_insight  smallint NOT NULL DEFAULT 2,
  incomplete_policy                incomplete_policy NOT NULL DEFAULT 'incomplete_no_score',
  status                           policy_status NOT NULL DEFAULT 'active',
  version_no                       integer NOT NULL DEFAULT 1,
  created_at                       timestamptz NOT NULL DEFAULT NOW(),
  updated_at                       timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON assessment.assessment_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- assessment.exam_templates
-- ============================================================
CREATE TABLE assessment.exam_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_code  varchar(80) UNIQUE NOT NULL,
  name       text NOT NULL,
  course_id  uuid NOT NULL REFERENCES content.courses(id),
  policy_id  uuid NOT NULL REFERENCES assessment.assessment_policies(id),
  status     template_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES app.profiles(id),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_exam_templates_updated_at
  BEFORE UPDATE ON assessment.exam_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- assessment.exam_template_versions
-- ============================================================
CREATE TABLE assessment.exam_template_versions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_template_id     uuid NOT NULL REFERENCES assessment.exam_templates(id),
  version_no           integer NOT NULL,
  duration_minutes     integer NOT NULL,
  questions_to_draw    integer NOT NULL,
  randomize_questions  boolean NOT NULL DEFAULT true,
  randomize_options    boolean NOT NULL DEFAULT true,
  total_score          numeric(7,2) NOT NULL DEFAULT 100.00,
  passing_score_snapshot numeric(5,2) NOT NULL,
  status               template_version_status NOT NULL DEFAULT 'draft',
  published_by         uuid REFERENCES app.profiles(id),
  published_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_template_version UNIQUE (exam_template_id, version_no)
);

-- Prevent editing published exam template versions
CREATE OR REPLACE FUNCTION assessment.prevent_edit_of_published_exam_template_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Cannot edit a published exam template version. Create a new version instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_published_etv_edit
  BEFORE UPDATE ON assessment.exam_template_versions
  FOR EACH ROW EXECUTE FUNCTION assessment.prevent_edit_of_published_exam_template_version();

-- ============================================================
-- assessment.exam_template_question_pool
-- ============================================================
CREATE TABLE assessment.exam_template_question_pool (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_template_version_id uuid NOT NULL REFERENCES assessment.exam_template_versions(id),
  question_version_id     uuid NOT NULL REFERENCES content.question_versions(id),
  selection_group         varchar(80),
  is_required             boolean NOT NULL DEFAULT false,
  score_weight            numeric(7,2) NOT NULL DEFAULT 5.00,
  priority                smallint,
  is_active               boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- assessment.assignments
-- ============================================================
CREATE TABLE assessment.assignments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_code          varchar(100) UNIQUE NOT NULL,
  name                     text NOT NULL,
  exam_template_version_id uuid NOT NULL REFERENCES assessment.exam_template_versions(id),
  assignment_status        assignment_status NOT NULL DEFAULT 'draft',
  opens_at                 timestamptz NOT NULL,
  closes_at                timestamptz NOT NULL,
  feedback_mode_snapshot   feedback_mode NOT NULL,
  feedback_release_at      timestamptz,
  feedback_released_by     uuid REFERENCES app.profiles(id),
  created_by               uuid REFERENCES app.profiles(id),
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_assignment_dates CHECK (opens_at < closes_at)
);

CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON assessment.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- assessment.assignment_recipients
-- ============================================================
CREATE TABLE assessment.assignment_recipients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id         uuid NOT NULL REFERENCES assessment.assignments(id),
  user_id               uuid NOT NULL REFERENCES app.profiles(id),
  recipient_status      recipient_status NOT NULL DEFAULT 'assigned',
  assigned_at           timestamptz NOT NULL DEFAULT NOW(),
  personal_deadline_at  timestamptz NOT NULL,
  source_target_type    target_type NOT NULL DEFAULT 'manual',
  source_target_id      uuid,
  manager_snapshot_id   uuid REFERENCES app.profiles(id),
  first_valid_attempt_id uuid,  -- FK added after attempts table created
  official_result_id    uuid,   -- FK added after official_results table created
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_recipient UNIQUE (assignment_id, user_id)
);

CREATE TRIGGER trg_recipients_updated_at
  BEFORE UPDATE ON assessment.assignment_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- assessment.deadline_extensions
-- ============================================================
CREATE TABLE assessment.deadline_extensions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_recipient_id uuid NOT NULL REFERENCES assessment.assignment_recipients(id),
  old_deadline_at         timestamptz NOT NULL,
  new_deadline_at         timestamptz NOT NULL,
  reason_code             extension_reason_code NOT NULL,
  reason_detail           text NOT NULL,
  requested_by            uuid NOT NULL REFERENCES app.profiles(id),
  approved_by             uuid REFERENCES app.profiles(id),
  approved_at             timestamptz,
  status                  approval_status NOT NULL DEFAULT 'pending',
  created_at              timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_extension_new_later CHECK (new_deadline_at > old_deadline_at)
);

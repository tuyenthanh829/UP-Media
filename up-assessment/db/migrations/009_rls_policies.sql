-- ============================================================
-- Migration 009: Row Level Security policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reporting_lines ENABLE ROW LEVEL SECURITY;

ALTER TABLE content.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE content.question_topics ENABLE ROW LEVEL SECURITY;

ALTER TABLE assessment.assessment_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.exam_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.exam_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.exam_template_question_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.assignment_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.deadline_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.attempt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.attempt_topic_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.official_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.score_override_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment.feedback_release_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE private.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.import_question_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.notion_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.audit_events ENABLE ROW LEVEL SECURITY;
-- attempt_answer_keys: no public access at all
ALTER TABLE private.attempt_answer_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- app.profiles
-- ============================================================
-- Users see their own profile; managers see direct reports; HR/admin see all
CREATE POLICY profiles_self ON app.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY profiles_manager ON app.profiles
  FOR SELECT USING (app.current_user_is_direct_manager_of(id));

CREATE POLICY profiles_hr_admin ON app.profiles
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR
    app.current_user_has_role('system_admin') OR
    app.current_user_has_role('kpi_admin') OR
    app.current_user_has_role('director')
  );

CREATE POLICY profiles_hr_insert ON app.profiles
  FOR INSERT WITH CHECK (
    app.current_user_has_role('hr_ld') OR app.current_user_has_role('system_admin')
  );

CREATE POLICY profiles_hr_update ON app.profiles
  FOR UPDATE USING (
    app.current_user_has_role('hr_ld') OR app.current_user_has_role('system_admin')
  );

-- ============================================================
-- assessment.attempts — learner sees only their own
-- ============================================================
CREATE POLICY attempts_own ON assessment.attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY attempts_hr_admin ON assessment.attempts
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR app.current_user_has_role('system_admin')
  );

CREATE POLICY attempts_own_insert ON assessment.attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY attempts_own_update ON assessment.attempts
  FOR UPDATE USING (user_id = auth.uid() AND status = 'in_progress');

-- ============================================================
-- assessment.attempt_items — learner sees their own in-progress
-- ============================================================
CREATE POLICY attempt_items_own ON assessment.attempt_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessment.attempts a
      WHERE a.id = attempt_id
        AND a.user_id = auth.uid()
        AND a.status = 'in_progress'
    )
  );

CREATE POLICY attempt_items_hr_admin ON assessment.attempt_items
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR app.current_user_has_role('system_admin')
  );

-- ============================================================
-- assessment.attempt_answers — learner can read/write their own in-progress
-- ============================================================
CREATE POLICY answers_own_select ON assessment.attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessment.attempt_items ai
      JOIN assessment.attempts a ON a.id = ai.attempt_id
      WHERE ai.id = attempt_item_id AND a.user_id = auth.uid()
    )
  );

CREATE POLICY answers_own_insert ON assessment.attempt_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM assessment.attempt_items ai
      JOIN assessment.attempts a ON a.id = ai.attempt_id
      WHERE ai.id = attempt_item_id
        AND a.user_id = auth.uid()
        AND a.status = 'in_progress'
    )
  );

CREATE POLICY answers_own_update ON assessment.attempt_answers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM assessment.attempt_items ai
      JOIN assessment.attempts a ON a.id = ai.attempt_id
      WHERE ai.id = attempt_item_id
        AND a.user_id = auth.uid()
        AND a.status = 'in_progress'
    )
  );

-- ============================================================
-- private.attempt_answer_keys — NO user access; grading RPC only
-- ============================================================
-- No policies = no access (RLS is enabled, default deny)
-- The submit_and_grade_attempt function uses SECURITY DEFINER

-- ============================================================
-- content.question_options — is_correct never exposed to learner
-- Learner gets options via attempt_items.options_snapshot (no is_correct)
-- ============================================================
CREATE POLICY question_options_content_reviewer ON content.question_options
  FOR SELECT USING (
    app.current_user_has_role('content_reviewer') OR
    app.current_user_has_role('hr_ld') OR
    app.current_user_has_role('system_admin')
  );

-- ============================================================
-- assessment.official_results
-- ============================================================
-- Learner sees own result
CREATE POLICY results_own ON assessment.official_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessment.assignment_recipients ar
      WHERE ar.id = assignment_recipient_id AND ar.user_id = auth.uid()
    )
  );

-- Manager sees direct reports' results
CREATE POLICY results_manager ON assessment.official_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assessment.assignment_recipients ar
      WHERE ar.id = assignment_recipient_id
        AND app.current_user_is_direct_manager_of(ar.user_id)
    )
  );

-- HR/KPI/Admin sees all
CREATE POLICY results_hr_kpi ON assessment.official_results
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR
    app.current_user_has_role('kpi_admin') OR
    app.current_user_has_role('director') OR
    app.current_user_has_role('system_admin')
  );

-- ============================================================
-- assignment_recipients — learner sees own; manager sees direct reports
-- ============================================================
CREATE POLICY recipients_own ON assessment.assignment_recipients
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY recipients_manager ON assessment.assignment_recipients
  FOR SELECT USING (app.current_user_is_direct_manager_of(user_id));

CREATE POLICY recipients_hr ON assessment.assignment_recipients
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR app.current_user_has_role('system_admin')
  );

-- ============================================================
-- audit_events — HR/KPI/Admin read only; no delete (handled by rule)
-- ============================================================
CREATE POLICY audit_read_authorized ON private.audit_events
  FOR SELECT USING (
    app.current_user_has_role('hr_ld') OR
    app.current_user_has_role('kpi_admin') OR
    app.current_user_has_role('director') OR
    app.current_user_has_role('system_admin')
  );

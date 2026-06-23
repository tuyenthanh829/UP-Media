-- ============================================================
-- Migration 010: Permission-safe database views
-- ============================================================

-- ============================================================
-- v_learner_dashboard — learner sees own assignments + status
-- ============================================================
CREATE OR REPLACE VIEW assessment.v_learner_dashboard
WITH (security_invoker = true)
AS
SELECT
  a.id                        AS assignment_id,
  a.name                      AS assignment_name,
  c.name                      AS course_name,
  ar.recipient_status,
  ar.personal_deadline_at,
  a.opens_at,
  a.closes_at,
  att.status                  AS attempt_status,
  att.score,
  att.pass_status             AS pass_fail,
  -- Feedback availability from policy + release events
  COALESCE(
    ap.show_score_immediately,
    false
  )                           AS feedback_available,
  EXISTS (
    SELECT 1 FROM assessment.feedback_release_events fre
    WHERE fre.assignment_id = a.id
      AND fre.release_type = 'answer_key'
  )                           AS correct_answers_available,
  EXISTS (
    SELECT 1 FROM assessment.feedback_release_events fre
    WHERE fre.assignment_id = a.id
      AND fre.release_type = 'explanation'
  )                           AS explanations_available
FROM assessment.assignment_recipients ar
JOIN assessment.assignments a ON a.id = ar.assignment_id
JOIN assessment.exam_template_versions etv ON etv.id = a.exam_template_version_id
JOIN assessment.exam_templates et ON et.id = etv.exam_template_id
JOIN content.courses c ON c.id = et.course_id
JOIN assessment.assessment_policies ap ON ap.id = et.policy_id
LEFT JOIN assessment.attempts att
  ON att.id = ar.first_valid_attempt_id
WHERE ar.user_id = auth.uid();

-- ============================================================
-- v_manager_results — manager sees direct reports only
-- No question text, no answer details
-- ============================================================
CREATE OR REPLACE VIEW assessment.v_manager_results
WITH (security_invoker = true)
AS
SELECT
  p.id                     AS employee_id,
  p.full_name              AS employee_name,
  p.employee_code,
  t.name                   AS team_name,
  a.name                   AS assessment_name,
  ar.recipient_status      AS completion_status,
  orr.official_score,
  orr.result_outcome,
  att.submitted_at,
  att.duration_seconds / 60 AS time_spent_minutes,
  (
    SELECT jsonb_agg(jsonb_build_object(
      'topicName',     ct.name,
      'accuracyPct',   ats.accuracy_percent,
      'insightStatus', ats.insight_status
    ))
    FROM assessment.attempt_topic_scores ats
    JOIN content.topics ct ON ct.id = ats.topic_id
    WHERE ats.attempt_id = att.id
      AND ats.insight_status = 'weak'
  )                        AS weak_topics,
  rl.manager_id,
  AVG(orr.official_score) OVER (
    PARTITION BY a.id, t.id
  )                        AS team_average
FROM app.reporting_lines rl
JOIN app.profiles p ON p.id = rl.employee_id
LEFT JOIN app.team_memberships tm ON tm.user_id = p.id AND tm.effective_to IS NULL AND tm.is_primary = true
LEFT JOIN app.teams t ON t.id = tm.team_id
JOIN assessment.assignment_recipients ar ON ar.user_id = p.id
JOIN assessment.assignments a ON a.id = ar.assignment_id
LEFT JOIN assessment.official_results orr ON orr.assignment_recipient_id = ar.id
LEFT JOIN assessment.attempts att ON att.id = ar.first_valid_attempt_id
WHERE rl.manager_id = auth.uid()
  AND rl.relationship_type = 'direct_manager'
  AND rl.effective_to IS NULL;

-- ============================================================
-- v_hr_result_queue — HR/L&D result confirmation view
-- ============================================================
CREATE OR REPLACE VIEW assessment.v_hr_result_queue
WITH (security_invoker = true)
AS
SELECT
  p.id                          AS employee_id,
  p.full_name                   AS employee_name,
  p.employee_code,
  a.name                        AS assessment_name,
  orr.official_score            AS first_attempt_score,
  orr.result_outcome            AS outcome,
  att.submitted_at              AS submission_timestamp,
  orr.incomplete_reason,
  de.status                     AS extension_status,
  orr.result_status,
  (orr.confirmed_at IS NULL AND orr.result_outcome <> 'pending_review') AS confirmation_action_required,
  orr.id                        AS result_id
FROM assessment.official_results orr
JOIN assessment.assignment_recipients ar ON ar.id = orr.assignment_recipient_id
JOIN app.profiles p ON p.id = ar.user_id
JOIN assessment.assignments a ON a.id = ar.assignment_id
LEFT JOIN assessment.attempts att ON att.id = orr.selected_attempt_id
LEFT JOIN LATERAL (
  SELECT status FROM assessment.deadline_extensions
  WHERE assignment_recipient_id = ar.id
  ORDER BY created_at DESC LIMIT 1
) de ON true
ORDER BY orr.created_at DESC;

-- ============================================================
-- v_kpi_lock_queue — KPI Admin/Director locking view
-- ============================================================
CREATE OR REPLACE VIEW assessment.v_kpi_lock_queue
WITH (security_invoker = true)
AS
SELECT
  p.full_name              AS employee_name,
  p.employee_code,
  a.name                   AS assessment_name,
  orr.official_score,
  orr.result_outcome,
  confirmer.full_name      AS hr_confirmed_by,
  orr.confirmed_at,
  EXISTS (
    SELECT 1 FROM assessment.score_override_requests sor
    WHERE sor.official_result_id = orr.id
      AND sor.status = 'pending'
  )                        AS override_pending,
  (
    orr.result_status = 'confirmed'
    AND NOT EXISTS (
      SELECT 1 FROM assessment.score_override_requests sor
      WHERE sor.official_result_id = orr.id AND sor.status = 'pending'
    )
  )                        AS ready_to_lock,
  orr.id                   AS result_id
FROM assessment.official_results orr
JOIN assessment.assignment_recipients ar ON ar.id = orr.assignment_recipient_id
JOIN app.profiles p ON p.id = ar.user_id
JOIN assessment.assignments a ON a.id = ar.assignment_id
LEFT JOIN app.profiles confirmer ON confirmer.id = orr.confirmed_by
WHERE orr.result_status = 'confirmed';

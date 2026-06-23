-- ============================================================
-- Migration 011: Deadline processing functions + pg_cron jobs
-- ============================================================

-- ============================================================
-- Function: process_assignment_deadlines
-- Run every 10 minutes via pg_cron
-- ============================================================
CREATE OR REPLACE FUNCTION assessment.process_assignment_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = assessment, app, private, public
AS $$
DECLARE
  v_recipient RECORD;
BEGIN
  FOR v_recipient IN
    SELECT
      ar.id,
      ar.user_id,
      ar.assignment_id,
      ar.personal_deadline_at,
      ar.first_valid_attempt_id,
      ar.recipient_status
    FROM assessment.assignment_recipients ar
    JOIN assessment.assignments a ON a.id = ar.assignment_id
    WHERE ar.personal_deadline_at < NOW()
      AND ar.recipient_status NOT IN ('pass', 'fail', 'incomplete')
      -- No pending approved extension beyond now
      AND NOT EXISTS (
        SELECT 1 FROM assessment.deadline_extensions de
        WHERE de.assignment_recipient_id = ar.id
          AND de.status = 'approved'
          AND de.new_deadline_at > NOW()
      )
  LOOP
    -- Case 1: valid attempt already exists — result already created by grading RPC
    IF v_recipient.first_valid_attempt_id IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Case 2: in-progress attempt not submitted — expire it
    UPDATE assessment.attempts SET
      status     = 'expired',
      updated_at = NOW()
    WHERE assignment_recipient_id = v_recipient.id
      AND status = 'in_progress';

    -- Case 3: create incomplete official result
    IF NOT EXISTS (
      SELECT 1 FROM assessment.official_results
      WHERE assignment_recipient_id = v_recipient.id
    ) THEN
      INSERT INTO assessment.official_results (
        assignment_recipient_id,
        result_outcome,
        official_score,
        is_kpi_eligible,
        policy_snapshot,
        result_status,
        incomplete_reason
      )
      SELECT
        v_recipient.id,
        'incomplete'::result_outcome,
        NULL,
        false,
        to_jsonb(ap.*),
        'draft'::official_result_status,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM assessment.attempts
            WHERE assignment_recipient_id = v_recipient.id
          ) THEN 'attempt_expired'::incomplete_reason
          ELSE 'not_started'::incomplete_reason
        END
      FROM assessment.assessment_policies ap
      JOIN assessment.exam_templates et ON et.policy_id = ap.id
      JOIN assessment.exam_template_versions etv ON etv.exam_template_id = et.id
      JOIN assessment.assignments a ON a.exam_template_version_id = etv.id
      WHERE a.id = v_recipient.assignment_id
      LIMIT 1;
    END IF;

    -- Update recipient status
    UPDATE assessment.assignment_recipients SET
      recipient_status = 'incomplete',
      updated_at       = NOW()
    WHERE id = v_recipient.id;

    -- Audit
    PERFORM private.log_audit_event(
      NULL, NULL, 'ATTEMPT_EXPIRED', 'assignment_recipient', v_recipient.id,
      NULL, jsonb_build_object('reason', 'deadline_passed')
    );
  END LOOP;
END;
$$;

-- ============================================================
-- Function: sync_assignment_statuses
-- Open/close assignments based on time windows
-- ============================================================
CREATE OR REPLACE FUNCTION assessment.sync_assignment_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = assessment, public
AS $$
BEGIN
  -- Open scheduled assignments
  UPDATE assessment.assignments SET
    assignment_status = 'open',
    updated_at        = NOW()
  WHERE assignment_status = 'scheduled'
    AND opens_at <= NOW();

  -- Close open assignments
  UPDATE assessment.assignments SET
    assignment_status = 'closed',
    updated_at        = NOW()
  WHERE assignment_status = 'open'
    AND closes_at <= NOW();
END;
$$;

-- ============================================================
-- Function: auto_release_feedback
-- Release feedback for assignments with after_close policy
-- ============================================================
CREATE OR REPLACE FUNCTION assessment.auto_release_feedback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = assessment, public
AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  FOR v_assignment IN
    SELECT id FROM assessment.assignments
    WHERE assignment_status = 'closed'
      AND feedback_mode_snapshot = 'after_close'
      AND (
        feedback_release_at IS NULL OR feedback_release_at <= NOW()
      )
      AND NOT EXISTS (
        SELECT 1 FROM assessment.feedback_release_events
        WHERE assignment_id = id AND release_type = 'answer_key'
      )
  LOOP
    INSERT INTO assessment.feedback_release_events
      (assignment_id, release_type, released_at, released_by, scope)
    VALUES
      (v_assignment.id, 'answer_key', NOW(), '00000000-0000-0000-0000-000000000000', 'all'),
      (v_assignment.id, 'explanation', NOW(), '00000000-0000-0000-0000-000000000000', 'all');
  END LOOP;
END;
$$;

-- ============================================================
-- pg_cron jobs (requires pg_cron extension)
-- ============================================================
SELECT cron.schedule('sync-assignment-statuses', '*/10 * * * *',
  $$SELECT assessment.sync_assignment_statuses();$$);

SELECT cron.schedule('process-deadlines', '*/10 * * * *',
  $$SELECT assessment.process_assignment_deadlines();$$);

SELECT cron.schedule('auto-release-feedback', '*/15 * * * *',
  $$SELECT assessment.auto_release_feedback();$$);

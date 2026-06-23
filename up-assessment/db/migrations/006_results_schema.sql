-- ============================================================
-- Migration 006: official results, overrides, feedback events
-- ============================================================

-- ============================================================
-- assessment.official_results
-- ============================================================
CREATE TABLE assessment.official_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_recipient_id uuid UNIQUE NOT NULL REFERENCES assessment.assignment_recipients(id),
  selected_attempt_id     uuid REFERENCES assessment.attempts(id),
  result_outcome          result_outcome NOT NULL DEFAULT 'pending_review',
  official_score          numeric(5,2),  -- NULL for incomplete
  is_kpi_eligible         boolean NOT NULL DEFAULT false,
  policy_snapshot         jsonb NOT NULL,
  manager_snapshot_id     uuid REFERENCES app.profiles(id),
  result_status           official_result_status NOT NULL DEFAULT 'draft',
  confirmed_by            uuid REFERENCES app.profiles(id),
  confirmed_at            timestamptz,
  locked_by               uuid REFERENCES app.profiles(id),
  locked_at               timestamptz,
  incomplete_reason       incomplete_reason,
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW(),

  -- A pass/fail result must reference a valid attempt
  CONSTRAINT chk_pass_fail_has_attempt CHECK (
    result_outcome NOT IN ('pass', 'fail') OR selected_attempt_id IS NOT NULL
  ),
  -- Incomplete must have NULL score
  CONSTRAINT chk_incomplete_null_score CHECK (
    result_outcome <> 'incomplete' OR official_score IS NULL
  ),
  -- Incomplete must have no selected attempt
  CONSTRAINT chk_incomplete_no_attempt CHECK (
    result_outcome <> 'incomplete' OR selected_attempt_id IS NULL
  )
);

CREATE TRIGGER trg_official_results_updated_at
  BEFORE UPDATE ON assessment.official_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add FK from assignment_recipients to official_result
ALTER TABLE assessment.assignment_recipients
  ADD CONSTRAINT fk_official_result
  FOREIGN KEY (official_result_id) REFERENCES assessment.official_results(id);

-- Prevent direct edit of locked results
CREATE OR REPLACE FUNCTION assessment.prevent_direct_edit_of_locked_result()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.result_status = 'locked' THEN
    RAISE EXCEPTION 'Cannot directly edit a locked official result. Use score override workflow.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_result_edit
  BEFORE UPDATE ON assessment.official_results
  FOR EACH ROW EXECUTE FUNCTION assessment.prevent_direct_edit_of_locked_result();

-- ============================================================
-- assessment.score_override_requests
-- ============================================================
CREATE TABLE assessment.score_override_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  official_result_id uuid NOT NULL REFERENCES assessment.official_results(id),
  old_score         numeric(5,2),
  requested_score   numeric(5,2),
  approved_score    numeric(5,2),
  reason_code       override_reason_code NOT NULL,
  reason_detail     text NOT NULL,
  evidence_url      text,
  requested_by      uuid NOT NULL REFERENCES app.profiles(id),
  approved_by       uuid REFERENCES app.profiles(id),
  approved_at       timestamptz,
  status            approval_status NOT NULL DEFAULT 'pending',
  applied_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT NOW(),

  -- Requester cannot approve their own request
  CONSTRAINT chk_no_self_approve CHECK (requested_by <> approved_by OR approved_by IS NULL)
);

-- ============================================================
-- assessment.feedback_release_events
-- ============================================================
CREATE TABLE assessment.feedback_release_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES assessment.assignments(id),
  release_type  feedback_release_type NOT NULL,
  released_at   timestamptz NOT NULL DEFAULT NOW(),
  released_by   uuid NOT NULL REFERENCES app.profiles(id),
  scope         feedback_scope NOT NULL DEFAULT 'all',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

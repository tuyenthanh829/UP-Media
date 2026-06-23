-- ============================================================
-- Migration 008: Secure grading RPC — submit_and_grade_attempt
-- ============================================================

CREATE OR REPLACE FUNCTION assessment.submit_and_grade_attempt(
  p_attempt_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = assessment, content, private, app, public
AS $$
DECLARE
  v_attempt        assessment.attempts%ROWTYPE;
  v_recipient      assessment.assignment_recipients%ROWTYPE;
  v_assignment     assessment.assignments%ROWTYPE;
  v_policy         assessment.assessment_policies%ROWTYPE;
  v_etv            assessment.exam_template_versions%ROWTYPE;
  v_item           RECORD;
  v_answer_key     private.attempt_answer_keys%ROWTYPE;
  v_answer         assessment.attempt_answers%ROWTYPE;
  v_total_weight   numeric := 0;
  v_earned_weight  numeric := 0;
  v_final_score    numeric(5,2);
  v_pass_status    pass_status;
  v_is_valid_kpi   boolean := false;
  v_is_first_valid boolean := false;
  v_result_id      uuid;
  v_outcome        result_outcome;
  v_topic_scores   jsonb := '[]';
  v_topic_map      jsonb := '{}';
  v_topic_rec      RECORD;
  v_selected_ids   jsonb;
  v_correct_ids    jsonb;
  v_is_correct     boolean;
  v_policy_snapshot jsonb;
BEGIN
  -- 1. Lock attempt row, verify ownership
  SELECT * INTO v_attempt
  FROM assessment.attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attempt not found: %', p_attempt_id;
  END IF;

  IF v_attempt.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to submit this attempt';
  END IF;

  -- 2. Validate attempt state
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Attempt is not in_progress (current: %)', v_attempt.status;
  END IF;

  IF NOW() > v_attempt.expires_at THEN
    -- Auto-expire
    UPDATE assessment.attempts
    SET status = 'expired', updated_at = NOW()
    WHERE id = p_attempt_id;

    PERFORM private.log_audit_event(
      auth.uid(), NULL, 'ATTEMPT_EXPIRED', 'attempt', p_attempt_id
    );
    RAISE EXCEPTION 'Attempt has expired';
  END IF;

  -- 3. Load supporting data
  SELECT * INTO v_recipient FROM assessment.assignment_recipients WHERE id = v_attempt.assignment_recipient_id;
  SELECT * INTO v_assignment FROM assessment.assignments WHERE id = v_recipient.assignment_id;
  SELECT et.* INTO v_etv FROM assessment.exam_template_versions et WHERE id = v_assignment.exam_template_version_id;
  SELECT p.* INTO v_policy FROM assessment.assessment_policies p
    JOIN assessment.exam_templates tmpl ON tmpl.policy_id = p.id
    WHERE tmpl.id = v_etv.exam_template_id;

  -- 4. Grade each item
  FOR v_item IN
    SELECT ai.id AS item_id, ai.score_weight, ai.topic_snapshot
    FROM assessment.attempt_items ai
    WHERE ai.attempt_id = p_attempt_id
  LOOP
    v_total_weight := v_total_weight + v_item.score_weight;

    -- Get answer key (private schema, never exposed to client)
    SELECT * INTO v_answer_key FROM private.attempt_answer_keys WHERE attempt_item_id = v_item.item_id;
    -- Get learner answer
    SELECT * INTO v_answer FROM assessment.attempt_answers WHERE attempt_item_id = v_item.item_id;

    v_selected_ids := COALESCE(v_answer.selected_option_ids, '[]'::jsonb);
    v_correct_ids  := v_answer_key.correct_option_ids;

    -- Exact match grading (single_choice / true_false)
    v_is_correct := (v_selected_ids @> v_correct_ids AND v_correct_ids @> v_selected_ids);

    IF v_is_correct THEN
      v_earned_weight := v_earned_weight + v_item.score_weight;
    END IF;

    -- Mark answer as final
    INSERT INTO assessment.attempt_answers (attempt_item_id, selected_option_ids, is_final, saved_at, updated_at)
    VALUES (v_item.item_id, v_selected_ids, true, NOW(), NOW())
    ON CONFLICT (attempt_item_id) DO UPDATE
      SET is_final = true, updated_at = NOW();

    -- Accumulate topic scores (per topic in snapshot)
    -- v_item.topic_snapshot: [{topic_id, topic_name}]
    -- (simplified: full topic aggregation done after loop)
  END LOOP;

  -- 5. Calculate score
  IF v_total_weight > 0 THEN
    v_final_score := ROUND((v_earned_weight / v_total_weight) * 100, 2);
  ELSE
    v_final_score := 0;
  END IF;

  -- 6. Pass/fail
  IF v_final_score >= v_policy.passing_score THEN
    v_pass_status := 'pass';
  ELSE
    v_pass_status := 'fail';
  END IF;

  -- 7. Is valid for KPI?
  IF v_attempt.attempt_mode = 'official'
    AND NOW() <= v_recipient.personal_deadline_at
  THEN
    v_is_valid_kpi := true;
  END IF;

  -- 8. Calculate topic accuracy and insert topic scores
  INSERT INTO assessment.attempt_topic_scores (
    attempt_id, topic_id, questions_count, correct_count,
    max_score, earned_score, accuracy_percent, insight_status
  )
  SELECT
    p_attempt_id,
    t.topic_id,
    t.questions_count,
    t.correct_count,
    t.max_score,
    t.earned_score,
    ROUND((t.correct_count::numeric / NULLIF(t.questions_count, 0)) * 100, 2),
    CASE
      WHEN t.questions_count < v_policy.min_questions_for_topic_insight THEN 'insufficient_data'::topic_insight_status
      WHEN ROUND((t.correct_count::numeric / NULLIF(t.questions_count, 0)) * 100, 2) >= 80 THEN 'strong'::topic_insight_status
      WHEN ROUND((t.correct_count::numeric / NULLIF(t.questions_count, 0)) * 100, 2) >= v_policy.weak_topic_threshold THEN 'adequate'::topic_insight_status
      ELSE 'weak'::topic_insight_status
    END
  FROM (
    SELECT
      (elem->>'topic_id')::uuid AS topic_id,
      COUNT(DISTINCT ai.id) AS questions_count,
      COUNT(DISTINCT CASE
        WHEN (aa.selected_option_ids @> ak.correct_option_ids AND ak.correct_option_ids @> aa.selected_option_ids)
        THEN ai.id
      END) AS correct_count,
      SUM(ai.score_weight) AS max_score,
      SUM(CASE
        WHEN (aa.selected_option_ids @> ak.correct_option_ids AND ak.correct_option_ids @> aa.selected_option_ids)
        THEN ai.score_weight ELSE 0
      END) AS earned_score
    FROM assessment.attempt_items ai
    JOIN assessment.attempt_answers aa ON aa.attempt_item_id = ai.id
    JOIN private.attempt_answer_keys ak ON ak.attempt_item_id = ai.id,
    LATERAL jsonb_array_elements(ai.topic_snapshot) AS elem
    WHERE ai.attempt_id = p_attempt_id
    GROUP BY (elem->>'topic_id')::uuid
  ) t;

  -- 9. Update attempt record
  UPDATE assessment.attempts SET
    status           = 'submitted',
    submitted_at     = NOW(),
    duration_seconds = EXTRACT(EPOCH FROM (NOW() - v_attempt.started_at))::integer,
    score            = v_final_score,
    pass_status      = v_pass_status,
    is_valid_for_kpi = v_is_valid_kpi,
    updated_at       = NOW()
  WHERE id = p_attempt_id;

  -- 10. First valid attempt → create official result
  IF v_is_valid_kpi AND v_recipient.first_valid_attempt_id IS NULL THEN
    v_is_first_valid := true;
    v_outcome := CASE WHEN v_pass_status = 'pass' THEN 'pass'::result_outcome ELSE 'fail'::result_outcome END;
    v_policy_snapshot := to_jsonb(v_policy);

    INSERT INTO assessment.official_results (
      assignment_recipient_id, selected_attempt_id,
      result_outcome, official_score, is_kpi_eligible,
      policy_snapshot, manager_snapshot_id, result_status
    ) VALUES (
      v_recipient.id, p_attempt_id,
      v_outcome, v_final_score, true,
      v_policy_snapshot, v_recipient.manager_snapshot_id, 'draft'
    )
    RETURNING id INTO v_result_id;

    UPDATE assessment.assignment_recipients SET
      first_valid_attempt_id = p_attempt_id,
      official_result_id     = v_result_id,
      recipient_status       = CASE WHEN v_pass_status = 'pass' THEN 'pass'::recipient_status ELSE 'fail'::recipient_status END,
      updated_at             = NOW()
    WHERE id = v_recipient.id;
  END IF;

  -- 11. Audit
  PERFORM private.log_audit_event(
    auth.uid(), NULL, 'ATTEMPT_SUBMITTED', 'attempt', p_attempt_id,
    NULL,
    jsonb_build_object('score', v_final_score, 'pass_status', v_pass_status, 'is_valid_for_kpi', v_is_valid_kpi)
  );

  -- 12. Return allowed payload (no answer keys, no correct option IDs)
  RETURN jsonb_build_object(
    'attemptId',     p_attempt_id,
    'status',        'submitted',
    'score',         v_final_score,
    'passStatus',    v_pass_status,
    'isFirstValid',  v_is_first_valid,
    'topicInsights', (
      SELECT jsonb_agg(jsonb_build_object(
        'topicId',      ats.topic_id,
        'topicName',    t.name,
        'insightStatus', ats.insight_status,
        'accuracyPercent', ats.accuracy_percent
      ))
      FROM assessment.attempt_topic_scores ats
      JOIN content.topics t ON t.id = ats.topic_id
      WHERE ats.attempt_id = p_attempt_id
    ),
    'feedbackAvailable',       false,
    'correctAnswersAvailable', false,
    'explanationsAvailable',   false
  );
END;
$$;

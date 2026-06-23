-- ============================================================
-- Seed 001: Roles, sample department/team, KPI policy
-- ============================================================

-- Roles
INSERT INTO app.roles (code, name, description) VALUES
  ('learner',          'Học viên',             'Nhân viên tham gia bài kiểm tra'),
  ('manager',          'Quản lý',              'Xem kết quả nhân viên trực thuộc'),
  ('content_reviewer', 'Người review nội dung', 'Review và publish câu hỏi'),
  ('hr_ld',            'HR / L&D',             'Quản lý đào tạo, xác nhận kết quả'),
  ('kpi_admin',        'KPI Admin',            'Khóa kết quả KPI chính thức'),
  ('director',         'Giám đốc',             'Phê duyệt cấp cao'),
  ('system_admin',     'System Admin',         'Quản trị kỹ thuật')
ON CONFLICT (code) DO NOTHING;

-- Sample department
INSERT INTO app.departments (id, code, name, status) VALUES
  ('11111111-0000-0000-0000-000000000001', 'ACCOUNT', 'Phòng Kế toán', 'active'),
  ('11111111-0000-0000-0000-000000000002', 'HR',      'Phòng Nhân sự',  'active')
ON CONFLICT (code) DO NOTHING;

-- Sample team
INSERT INTO app.teams (id, department_id, name, status) VALUES
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Team Kế toán tổng hợp', 'active'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', 'Team HR L&D',           'active')
ON CONFLICT DO NOTHING;

-- KPI Policy: KPI-FIRST-ATTEMPT-V1
INSERT INTO assessment.assessment_policies (
  id,
  policy_code,
  policy_name,
  assessment_class,
  score_rule,
  passing_score,
  attempt_limit_official,
  allow_practice_retake,
  feedback_mode,
  show_score_immediately,
  show_pass_fail_immediately,
  show_topic_feedback_immediately,
  show_correct_answers_immediately,
  show_explanations_immediately,
  weak_topic_threshold,
  min_questions_for_topic_insight,
  incomplete_policy,
  status,
  version_no
) VALUES (
  '33333333-0000-0000-0000-000000000001',
  'KPI-FIRST-ATTEMPT-V1',
  'KPI First Valid Attempt',
  'official_kpi',
  'first_valid_submitted_attempt',
  80.00,
  1,
  true,
  'after_close',
  true,
  true,
  true,
  false,
  false,
  70.00,
  2,
  'incomplete_no_score',
  'active',
  1
) ON CONFLICT (policy_code) DO NOTHING;

// Auto-generated types aligned with DB migrations
// Run: supabase gen types typescript --local > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ---- Enums ----
export type EmploymentStatus = 'invited' | 'active' | 'suspended' | 'offboarded'
export type EntityStatus = 'active' | 'archived'
export type ReportingRelationshipType = 'direct_manager' | 'dotted_line' | 'department_head'
export type CourseStatus = 'draft' | 'active' | 'archived'
export type QuestionSourceType = 'notebooklm' | 'manual' | 'sme' | 'imported'
export type QuestionStatus = 'draft' | 'in_review' | 'published' | 'retired'
export type QuestionType = 'single_choice' | 'true_false'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'
export type ReviewStatus = 'draft' | 'reviewed' | 'published' | 'rejected'
export type AssessmentClass = 'practice' | 'required' | 'official_kpi'
export type ScoreRule = 'first_valid_submitted_attempt' | 'latest_valid_attempt' | 'best_valid_attempt'
export type FeedbackMode = 'after_close' | 'manual_release' | 'never'
export type IncompletePolicy = 'incomplete_no_score'
export type PolicyStatus = 'draft' | 'active' | 'retired'
export type TemplateStatus = 'draft' | 'active' | 'archived'
export type TemplateVersionStatus = 'draft' | 'published' | 'retired'
export type AssignmentStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'archived'
export type RecipientStatus = 'assigned' | 'in_progress' | 'submitted' | 'pass' | 'fail' | 'incomplete' | 'extended'
export type TargetType = 'manual' | 'team' | 'department' | 'import'
export type ExtensionReasonCode = 'approved_leave' | 'system_issue' | 'business_exception' | 'other'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'applied'
export type AttemptMode = 'official' | 'practice' | 'replacement'
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired' | 'invalidated'
export type PassStatus = 'pending' | 'pass' | 'fail' | 'not_applicable'
export type TopicInsightStatus = 'strong' | 'adequate' | 'weak' | 'insufficient_data'
export type ResultOutcome = 'pass' | 'fail' | 'incomplete' | 'invalid' | 'pending_review'
export type OfficialResultStatus = 'draft' | 'confirmed' | 'locked' | 'invalidated'
export type IncompleteReason = 'not_started' | 'not_submitted' | 'attempt_expired' | 'approved_leave' | 'system_issue' | 'other_approved_exception'
export type OverrideReasonCode = 'system_error' | 'policy_correction' | 'human_review' | 'approved_exception'
export type FeedbackReleaseType = 'score' | 'answer_key' | 'explanation'
export type FeedbackScope = 'all' | 'selected_users'
export type ImportStatus = 'received' | 'validating' | 'imported' | 'failed'
export type CandidateValidationStatus = 'valid' | 'warning' | 'invalid'
export type CandidateReviewStatus = 'pending' | 'approved' | 'rejected'
export type SyncDirection = 'notion_to_supabase' | 'supabase_to_notion'
export type SyncStatus = 'success' | 'skipped' | 'failed'

// ---- App Schema ----
export interface Profile {
  id: string
  employee_code: string
  email: string
  full_name: string
  job_title: string | null
  employment_status: EmploymentStatus
  joined_at: string | null
  probation_end_at: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Role {
  code: string
  name: string
  description: string | null
  is_active: boolean
}

export interface UserRole {
  id: string
  user_id: string
  role_code: string
  assigned_by: string | null
  assigned_at: string
  revoked_at: string | null
}

export interface Department {
  id: string
  code: string
  name: string
  department_head_id: string | null
  status: EntityStatus
  created_at: string
}

export interface Team {
  id: string
  department_id: string
  name: string
  team_lead_id: string | null
  status: EntityStatus
  created_at: string
}

export interface ReportingLine {
  id: string
  employee_id: string
  manager_id: string
  relationship_type: ReportingRelationshipType
  effective_from: string
  effective_to: string | null
  is_primary: boolean
  created_by: string | null
  created_at: string
}

// ---- Content Schema ----
export interface Course {
  id: string
  course_code: string
  name: string
  description: string | null
  owner_id: string | null
  status: CourseStatus
  passing_score_default: number
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  question_code: string
  course_id: string
  source_type: QuestionSourceType
  notion_page_id: string | null
  status: QuestionStatus
  current_version_no: number
  created_by: string | null
  created_at: string
  retired_at: string | null
}

export interface QuestionVersion {
  id: string
  question_id: string
  version_no: number
  question_type: QuestionType
  stem: string
  explanation: string | null
  difficulty: DifficultyLevel
  language_code: string
  source_reference: string | null
  content_hash: string | null
  review_status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  published_at: string | null
  created_by: string | null
  created_at: string
}

export interface QuestionOption {
  id: string
  question_version_id: string
  canonical_key: string
  option_text: string
  is_correct: boolean  // NEVER sent to browser
  canonical_order: number
  created_at: string
}

// ---- Assessment Schema ----
export interface AssessmentPolicy {
  id: string
  policy_code: string
  policy_name: string
  assessment_class: AssessmentClass
  score_rule: ScoreRule
  passing_score: number
  attempt_limit_official: number
  allow_practice_retake: boolean
  feedback_mode: FeedbackMode
  show_score_immediately: boolean
  show_pass_fail_immediately: boolean
  show_topic_feedback_immediately: boolean
  show_correct_answers_immediately: boolean
  show_explanations_immediately: boolean
  weak_topic_threshold: number
  min_questions_for_topic_insight: number
  incomplete_policy: IncompletePolicy
  status: PolicyStatus
  version_no: number
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  assignment_code: string
  name: string
  exam_template_version_id: string
  assignment_status: AssignmentStatus
  opens_at: string
  closes_at: string
  feedback_mode_snapshot: FeedbackMode
  feedback_release_at: string | null
  feedback_released_by: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface AssignmentRecipient {
  id: string
  assignment_id: string
  user_id: string
  recipient_status: RecipientStatus
  assigned_at: string
  personal_deadline_at: string
  source_target_type: TargetType
  source_target_id: string | null
  manager_snapshot_id: string | null
  first_valid_attempt_id: string | null
  official_result_id: string | null
  created_at: string
  updated_at: string
}

export interface Attempt {
  id: string
  assignment_recipient_id: string
  user_id: string
  attempt_no: number
  attempt_mode: AttemptMode
  status: AttemptStatus
  started_at: string | null
  submitted_at: string | null
  expires_at: string
  duration_seconds: number | null
  score: number | null
  total_score: number
  pass_status: PassStatus
  is_valid_for_kpi: boolean
  invalid_reason: string | null
  submitted_ip_hash: string | null
  created_at: string
  updated_at: string
}

// options_snapshot item — no is_correct field
export interface OptionSnapshot {
  option_id: string
  display_order: number
  option_text: string
}

export interface TopicSnapshot {
  topic_id: string
  topic_name: string
}

export interface AttemptItem {
  id: string
  attempt_id: string
  question_version_id: string
  question_stem_snapshot: string
  question_type_snapshot: QuestionType
  options_snapshot: OptionSnapshot[]  // no is_correct
  topic_snapshot: TopicSnapshot[]
  display_order: number
  score_weight: number
  is_required: boolean
  created_at: string
}

export interface AttemptAnswer {
  id: string
  attempt_item_id: string
  selected_option_ids: string[]
  is_final: boolean
  saved_at: string
  updated_at: string
}

export interface OfficialResult {
  id: string
  assignment_recipient_id: string
  selected_attempt_id: string | null
  result_outcome: ResultOutcome
  official_score: number | null
  is_kpi_eligible: boolean
  policy_snapshot: Json
  manager_snapshot_id: string | null
  result_status: OfficialResultStatus
  confirmed_by: string | null
  confirmed_at: string | null
  locked_by: string | null
  locked_at: string | null
  incomplete_reason: IncompleteReason | null
  created_at: string
  updated_at: string
}

// ---- Grading RPC return type ----
export interface TopicInsight {
  topicId: string
  topicName: string
  insightStatus: TopicInsightStatus
  accuracyPercent: number
}

export interface GradingResult {
  attemptId: string
  status: 'submitted'
  score: number
  passStatus: PassStatus
  isFirstValid: boolean
  topicInsights: TopicInsight[]
  feedbackAvailable: boolean
  correctAnswersAvailable: boolean
  explanationsAvailable: boolean
}

// ---- Database interface (for Supabase client) ----
export type Database = {
  app: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      roles: { Row: Role; Insert: Partial<Role>; Update: Partial<Role> }
      user_roles: { Row: UserRole; Insert: Partial<UserRole>; Update: Partial<UserRole> }
      departments: { Row: Department; Insert: Partial<Department>; Update: Partial<Department> }
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team> }
      reporting_lines: { Row: ReportingLine; Insert: Partial<ReportingLine>; Update: Partial<ReportingLine> }
    }
  }
  content: {
    Tables: {
      courses: { Row: Course; Insert: Partial<Course>; Update: Partial<Course> }
      questions: { Row: Question; Insert: Partial<Question>; Update: Partial<Question> }
      question_versions: { Row: QuestionVersion; Insert: Partial<QuestionVersion>; Update: Partial<QuestionVersion> }
      question_options: { Row: QuestionOption; Insert: Partial<QuestionOption>; Update: Partial<QuestionOption> }
    }
  }
  assessment: {
    Tables: {
      assessment_policies: { Row: AssessmentPolicy; Insert: Partial<AssessmentPolicy>; Update: Partial<AssessmentPolicy> }
      assignments: { Row: Assignment; Insert: Partial<Assignment>; Update: Partial<Assignment> }
      assignment_recipients: { Row: AssignmentRecipient; Insert: Partial<AssignmentRecipient>; Update: Partial<AssignmentRecipient> }
      attempts: { Row: Attempt; Insert: Partial<Attempt>; Update: Partial<Attempt> }
      attempt_items: { Row: AttemptItem; Insert: Partial<AttemptItem>; Update: Partial<AttemptItem> }
      attempt_answers: { Row: AttemptAnswer; Insert: Partial<AttemptAnswer>; Update: Partial<AttemptAnswer> }
      official_results: { Row: OfficialResult; Insert: Partial<OfficialResult>; Update: Partial<OfficialResult> }
    }
    Views: {
      v_learner_dashboard: { Row: Record<string, unknown> }
      v_manager_results: { Row: Record<string, unknown> }
      v_hr_result_queue: { Row: Record<string, unknown> }
      v_kpi_lock_queue: { Row: Record<string, unknown> }
    }
    Functions: {
      submit_and_grade_attempt: {
        Args: { p_attempt_id: string }
        Returns: GradingResult
      }
    }
  }
  private: {
    Tables: {
      import_jobs: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
      audit_events: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }
    }
  }
}

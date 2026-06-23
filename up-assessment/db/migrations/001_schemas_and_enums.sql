-- ============================================================
-- Migration 001: Schemas + All Enums
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS content;
CREATE SCHEMA IF NOT EXISTS assessment;
CREATE SCHEMA IF NOT EXISTS private;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE employment_status AS ENUM ('invited', 'active', 'suspended', 'offboarded');
CREATE TYPE entity_status AS ENUM ('active', 'archived');
CREATE TYPE reporting_relationship_type AS ENUM ('direct_manager', 'dotted_line', 'department_head');

CREATE TYPE course_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE question_source_type AS ENUM ('notebooklm', 'manual', 'sme', 'imported');
CREATE TYPE question_status AS ENUM ('draft', 'in_review', 'published', 'retired');
CREATE TYPE question_type AS ENUM ('single_choice', 'true_false');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE review_status AS ENUM ('draft', 'reviewed', 'published', 'rejected');

CREATE TYPE assessment_class AS ENUM ('practice', 'required', 'official_kpi');
CREATE TYPE score_rule AS ENUM ('first_valid_submitted_attempt', 'latest_valid_attempt', 'best_valid_attempt');
CREATE TYPE feedback_mode AS ENUM ('after_close', 'manual_release', 'never');
CREATE TYPE incomplete_policy AS ENUM ('incomplete_no_score');
CREATE TYPE policy_status AS ENUM ('draft', 'active', 'retired');

CREATE TYPE template_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE template_version_status AS ENUM ('draft', 'published', 'retired');
CREATE TYPE assignment_status AS ENUM ('draft', 'scheduled', 'open', 'closed', 'archived');
CREATE TYPE recipient_status AS ENUM ('assigned', 'in_progress', 'submitted', 'pass', 'fail', 'incomplete', 'extended');
CREATE TYPE target_type AS ENUM ('manual', 'team', 'department', 'import');
CREATE TYPE extension_reason_code AS ENUM ('approved_leave', 'system_issue', 'business_exception', 'other');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'revoked', 'applied');

CREATE TYPE attempt_mode AS ENUM ('official', 'practice', 'replacement');
CREATE TYPE attempt_status AS ENUM ('not_started', 'in_progress', 'submitted', 'expired', 'invalidated');
CREATE TYPE pass_status AS ENUM ('pending', 'pass', 'fail', 'not_applicable');
CREATE TYPE topic_insight_status AS ENUM ('strong', 'adequate', 'weak', 'insufficient_data');

CREATE TYPE result_outcome AS ENUM ('pass', 'fail', 'incomplete', 'invalid', 'pending_review');
CREATE TYPE official_result_status AS ENUM ('draft', 'confirmed', 'locked', 'invalidated');
CREATE TYPE incomplete_reason AS ENUM (
  'not_started', 'not_submitted', 'attempt_expired',
  'approved_leave', 'system_issue', 'other_approved_exception'
);
CREATE TYPE override_reason_code AS ENUM ('system_error', 'policy_correction', 'human_review', 'approved_exception');
CREATE TYPE feedback_release_type AS ENUM ('score', 'answer_key', 'explanation');
CREATE TYPE feedback_scope AS ENUM ('all', 'selected_users');

CREATE TYPE import_status AS ENUM ('received', 'validating', 'imported', 'failed');
CREATE TYPE candidate_validation_status AS ENUM ('valid', 'warning', 'invalid');
CREATE TYPE candidate_review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE sync_direction AS ENUM ('notion_to_supabase', 'supabase_to_notion');
CREATE TYPE sync_status AS ENUM ('success', 'skipped', 'failed');

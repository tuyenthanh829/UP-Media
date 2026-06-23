-- ============================================================
-- Migration 002: app schema — profiles, roles, org hierarchy
-- ============================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- app.profiles
-- ============================================================
CREATE TABLE app.profiles (
  id                uuid PRIMARY KEY,  -- same as auth.users.id
  employee_code     varchar(30) UNIQUE NOT NULL,
  email             citext UNIQUE NOT NULL,
  full_name         text NOT NULL,
  job_title         text,
  employment_status employment_status NOT NULL DEFAULT 'invited',
  joined_at         date,
  probation_end_at  date,
  avatar_url        text,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_auth_user FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON app.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- app.roles
-- ============================================================
CREATE TABLE app.roles (
  code        text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true
);

-- ============================================================
-- app.user_roles
-- ============================================================
CREATE TABLE app.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  role_code   text NOT NULL REFERENCES app.roles(code),
  assigned_by uuid REFERENCES app.profiles(id),
  assigned_at timestamptz NOT NULL DEFAULT NOW(),
  revoked_at  timestamptz
);

-- Prevent duplicate active role assignments
CREATE UNIQUE INDEX uq_user_roles_active
  ON app.user_roles (user_id, role_code)
  WHERE revoked_at IS NULL;

-- ============================================================
-- app.departments
-- ============================================================
CREATE TABLE app.departments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code               varchar(50) UNIQUE NOT NULL,
  name               text NOT NULL,
  department_head_id uuid REFERENCES app.profiles(id),
  status             entity_status NOT NULL DEFAULT 'active',
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- app.teams
-- ============================================================
CREATE TABLE app.teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES app.departments(id),
  name          text NOT NULL,
  team_lead_id  uuid REFERENCES app.profiles(id),
  status        entity_status NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- app.team_memberships
-- ============================================================
CREATE TABLE app.team_memberships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  team_id        uuid NOT NULL REFERENCES app.teams(id),
  is_primary     boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to   date,
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

-- ============================================================
-- app.reporting_lines
-- ============================================================
CREATE TABLE app.reporting_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  manager_id        uuid NOT NULL REFERENCES app.profiles(id),
  relationship_type reporting_relationship_type NOT NULL,
  effective_from    date NOT NULL DEFAULT CURRENT_DATE,
  effective_to      date,
  is_primary        boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES app.profiles(id),
  created_at        timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_no_self_report CHECK (employee_id <> manager_id)
);

-- Only one active primary direct manager per employee at a time
CREATE UNIQUE INDEX uq_reporting_primary_active
  ON app.reporting_lines (employee_id)
  WHERE relationship_type = 'direct_manager'
    AND is_primary = true
    AND effective_to IS NULL;

-- ============================================================
-- Helper: check active role
-- ============================================================
CREATE OR REPLACE FUNCTION app.current_user_has_role(role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role_code = $1
      AND ur.revoked_at IS NULL
  );
$$;

-- ============================================================
-- Helper: check if current user is direct manager of employee
-- ============================================================
CREATE OR REPLACE FUNCTION app.current_user_is_direct_manager_of(employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = app, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app.reporting_lines rl
    WHERE rl.employee_id = $1
      AND rl.manager_id = auth.uid()
      AND rl.relationship_type = 'direct_manager'
      AND rl.is_primary = true
      AND rl.effective_to IS NULL
  );
$$;

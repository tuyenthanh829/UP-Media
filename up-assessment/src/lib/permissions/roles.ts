import { createClient } from '@/lib/supabase/server'

export type RoleCode =
  | 'learner' | 'manager' | 'content_reviewer'
  | 'hr_ld' | 'kpi_admin' | 'director' | 'system_admin'

export async function getUserRoles(userId: string): Promise<RoleCode[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('app')
    .from('user_roles')
    .select('role_code')
    .eq('user_id', userId)
    .is('revoked_at', null)

  return (data ?? []).map(r => r.role_code as RoleCode)
}

export function hasRole(roles: RoleCode[], ...required: RoleCode[]): boolean {
  return required.some(r => roles.includes(r))
}

export function requireRole(roles: RoleCode[], ...required: RoleCode[]): void {
  if (!hasRole(roles, ...required)) {
    throw new Error(`Access denied. Required role: ${required.join(' or ')}`)
  }
}

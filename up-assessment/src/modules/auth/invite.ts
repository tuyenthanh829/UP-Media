'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getUserRoles, requireRole } from '@/lib/permissions/roles'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const InviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  employeeCode: z.string().min(2).max(30),
  jobTitle: z.string().optional(),
  roleCode: z.enum(['learner', 'manager', 'content_reviewer', 'hr_ld', 'kpi_admin', 'director', 'system_admin']),
})

export async function inviteEmployee(input: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const roles = await getUserRoles(user.id)
  requireRole(roles, 'hr_ld', 'system_admin')

  const validated = InviteSchema.parse(input)

  const admin = createAdminClient()

  // Invite via Supabase Auth (sends activation email)
  const { data: authUser, error } = await admin.auth.admin.inviteUserByEmail(
    validated.email,
    { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/activate` }
  )

  if (error) {
    console.error('[inviteEmployee] auth error:', error.message)
    throw new Error('Không thể gửi lời mời. Vui lòng thử lại.')
  }

  // Create profile
  await admin
    .schema('app')
    .from('profiles')
    .insert({
      id: authUser.user.id,
      email: validated.email,
      full_name: validated.fullName,
      employee_code: validated.employeeCode,
      job_title: validated.jobTitle ?? null,
      employment_status: 'invited',
    })

  // Assign role
  await admin
    .schema('app')
    .from('user_roles')
    .insert({
      user_id: authUser.user.id,
      role_code: validated.roleCode,
      assigned_by: user.id,
    })

  // Audit
  await admin
    .schema('private')
    .from('audit_events')
    .insert({
      actor_user_id:       user.id,
      actor_role_snapshot: roles,
      action_type:         'USER_INVITED',
      entity_type:         'profile',
      entity_id:           authUser.user.id,
      new_data:            { email: validated.email, role: validated.roleCode },
      occurred_at:         new Date().toISOString(),
    })
}

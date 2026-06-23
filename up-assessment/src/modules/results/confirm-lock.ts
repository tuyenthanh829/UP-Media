'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserRoles, requireRole } from '@/lib/permissions/roles'

export async function confirmResult(resultId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const roles = await getUserRoles(user.id)
  requireRole(roles, 'hr_ld', 'system_admin')

  const { data: result } = await supabase
    .schema('assessment')
    .from('official_results')
    .select('result_status, result_outcome')
    .eq('id', resultId)
    .single()

  if (!result) throw new Error('Kết quả không tồn tại')
  if (result.result_status === 'locked') throw new Error('Kết quả đã bị khóa')
  if (result.result_status === 'confirmed') throw new Error('Kết quả đã được xác nhận')

  await supabase
    .schema('assessment')
    .from('official_results')
    .update({
      result_status: 'confirmed',
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', resultId)

  // Audit
  await supabase
    .schema('private')
    .from('audit_events')
    .insert({
      actor_user_id:       user.id,
      actor_role_snapshot: roles,
      action_type:         'RESULT_CONFIRMED',
      entity_type:         'official_result',
      entity_id:           resultId,
      occurred_at:         new Date().toISOString(),
    })
}

export async function lockResult(resultId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const roles = await getUserRoles(user.id)
  requireRole(roles, 'kpi_admin', 'director', 'system_admin')

  const { data: result } = await supabase
    .schema('assessment')
    .from('official_results')
    .select('result_status')
    .eq('id', resultId)
    .single()

  if (!result) throw new Error('Kết quả không tồn tại')
  if (result.result_status !== 'confirmed') throw new Error('Kết quả chưa được HR xác nhận')

  // Check no pending override
  const { count } = await supabase
    .schema('assessment')
    .from('score_override_requests')
    .select('id', { count: 'exact', head: true })
    .eq('official_result_id', resultId)
    .eq('status', 'pending')

  if ((count ?? 0) > 0) throw new Error('Đang có yêu cầu điều chỉnh điểm chờ duyệt')

  await supabase
    .schema('assessment')
    .from('official_results')
    .update({
      result_status: 'locked',
      locked_by: user.id,
      locked_at: new Date().toISOString(),
    })
    .eq('id', resultId)

  await supabase
    .schema('private')
    .from('audit_events')
    .insert({
      actor_user_id:       user.id,
      actor_role_snapshot: roles,
      action_type:         'RESULT_LOCKED',
      entity_type:         'official_result',
      entity_id:           resultId,
      occurred_at:         new Date().toISOString(),
    })
}

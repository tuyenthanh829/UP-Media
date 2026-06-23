import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { ConfirmResultButton } from '@/components/hr/confirm-result-button'
import { formatScore } from '@/lib/utils'

export default async function HRResultQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'hr_ld', 'system_admin')) redirect('/learner/assignments')

  const { data: queue } = await supabase
    .schema('assessment')
    .from('v_hr_result_queue')
    .select('*')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">HR / L&D — Xác nhận kết quả</h1>
        <span className="text-sm text-gray-500">{queue?.length ?? 0} kết quả</span>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Nhân viên</th>
              <th className="text-left p-3 font-medium">Bài kiểm tra</th>
              <th className="text-right p-3 font-medium">Điểm</th>
              <th className="text-left p-3 font-medium">Kết quả</th>
              <th className="text-left p-3 font-medium">Trạng thái</th>
              <th className="text-left p-3 font-medium">Incomplete reason</th>
              <th className="text-center p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(queue ?? []).map((r: any) => (
              <tr key={r.result_id} className="hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{r.employee_name}</div>
                  <div className="text-gray-400 text-xs">{r.employee_code}</div>
                </td>
                <td className="p-3 text-gray-600">{r.assessment_name}</td>
                <td className="p-3 text-right font-medium">{formatScore(r.first_attempt_score)}</td>
                <td className="p-3">
                  <OutcomeBadge outcome={r.outcome} />
                </td>
                <td className="p-3">
                  <ResultStatusBadge status={r.result_status} />
                </td>
                <td className="p-3 text-xs text-gray-500">{r.incomplete_reason ?? '—'}</td>
                <td className="p-3 text-center">
                  {r.result_status === 'draft' && (
                    <ConfirmResultButton resultId={r.result_id} />
                  )}
                  {r.result_status === 'confirmed' && (
                    <span className="text-green-600 text-xs">✓ Đã xác nhận</span>
                  )}
                  {r.result_status === 'locked' && (
                    <span className="text-blue-600 text-xs">🔒 Đã khóa</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pass:           { label: 'Đạt',               color: 'bg-green-100 text-green-700' },
    fail:           { label: 'Chưa đạt',          color: 'bg-red-100 text-red-700' },
    incomplete:     { label: 'Không hoàn thành',  color: 'bg-orange-100 text-orange-700' },
    pending_review: { label: 'Chờ xem xét',       color: 'bg-yellow-100 text-yellow-700' },
    invalid:        { label: 'Không hợp lệ',      color: 'bg-gray-100 text-gray-600' },
  }
  const s = map[outcome] ?? { label: outcome, color: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

function ResultStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    draft:     { label: 'Draft',       color: 'text-gray-500' },
    confirmed: { label: 'Confirmed',   color: 'text-green-600' },
    locked:    { label: 'Locked 🔒',  color: 'text-blue-600' },
  }
  const s = map[status] ?? { label: status, color: 'text-gray-400' }
  return <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
}

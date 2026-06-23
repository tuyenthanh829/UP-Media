import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { LockResultButton } from '@/components/kpi/lock-result-button'
import { formatScore } from '@/lib/utils'

export default async function KPILockQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'kpi_admin', 'director', 'system_admin')) redirect('/learner/assignments')

  const { data: queue } = await supabase
    .schema('assessment')
    .from('v_kpi_lock_queue')
    .select('*')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">KPI Lock Queue</h1>
        <span className="text-sm text-gray-500">
          {queue?.filter((r: any) => r.ready_to_lock).length ?? 0} sẵn sàng khóa
        </span>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Nhân viên</th>
              <th className="text-left p-3 font-medium">Bài kiểm tra</th>
              <th className="text-right p-3 font-medium">Điểm KPI</th>
              <th className="text-left p-3 font-medium">Kết quả</th>
              <th className="text-left p-3 font-medium">HR Confirmed by</th>
              <th className="text-center p-3 font-medium">Override</th>
              <th className="text-center p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(queue ?? []).map((r: any) => (
              <tr key={r.result_id} className={`hover:bg-gray-50 ${!r.ready_to_lock ? 'opacity-60' : ''}`}>
                <td className="p-3">
                  <div className="font-medium">{r.employee_name}</div>
                  <div className="text-gray-400 text-xs">{r.employee_code}</div>
                </td>
                <td className="p-3 text-gray-600">{r.assessment_name}</td>
                <td className="p-3 text-right font-bold text-lg">{formatScore(r.official_score)}</td>
                <td className="p-3">
                  <OutcomeBadge outcome={r.result_outcome} />
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {r.hr_confirmed_by ?? '—'}
                </td>
                <td className="p-3 text-center">
                  {r.override_pending && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                      Pending override
                    </span>
                  )}
                </td>
                <td className="p-3 text-center">
                  {r.ready_to_lock ? (
                    <LockResultButton resultId={r.result_id} />
                  ) : (
                    <span className="text-gray-400 text-xs">Chờ điều kiện</span>
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
    pass: { label: 'Đạt', color: 'bg-green-100 text-green-700' },
    fail: { label: 'Chưa đạt', color: 'bg-red-100 text-red-700' },
    incomplete: { label: 'Incomplete', color: 'bg-orange-100 text-orange-700' },
  }
  const s = map[outcome] ?? { label: outcome, color: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

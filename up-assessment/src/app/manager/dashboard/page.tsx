import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { formatScore, formatDuration } from '@/lib/utils'

export default async function ManagerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'manager', 'hr_ld', 'kpi_admin', 'director', 'system_admin')) {
    redirect('/learner/assignments')
  }

  const { data: results } = await supabase
    .schema('assessment')
    .from('v_manager_results')
    .select('*')

  const totalAssigned  = results?.length ?? 0
  const completed      = results?.filter((r: any) => ['pass', 'fail'].includes(r.completion_status)).length ?? 0
  const passed         = results?.filter((r: any) => r.completion_status === 'pass').length ?? 0
  const incomplete     = results?.filter((r: any) => r.completion_status === 'incomplete').length ?? 0

  const completionRate = totalAssigned > 0 ? ((completed / totalAssigned) * 100).toFixed(0) : '—'
  const passRate       = completed > 0 ? ((passed / completed) * 100).toFixed(0) : '—'
  const incompleteRate = totalAssigned > 0 ? ((incomplete / totalAssigned) * 100).toFixed(0) : '—'

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Manager Dashboard</h1>

      {/* KPI Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Tỷ lệ hoàn thành" value={`${completionRate}%`} sub={`${completed}/${totalAssigned}`} />
        <MetricCard label="Tỷ lệ đạt" value={`${passRate}%`} sub={`trong số đã hoàn thành`} color="green" />
        <MetricCard label="Tỷ lệ Incomplete" value={`${incompleteRate}%`} sub={`${incomplete} người`} color="orange" />
      </div>

      {/* Employee table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium">Nhân viên</th>
              <th className="text-left p-3 font-medium">Bài kiểm tra</th>
              <th className="text-left p-3 font-medium">Trạng thái</th>
              <th className="text-right p-3 font-medium">Điểm</th>
              <th className="text-left p-3 font-medium">Chủ đề yếu</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(results ?? []).map((r: any, i: number) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="p-3">
                  <div className="font-medium">{r.employee_name}</div>
                  <div className="text-gray-400 text-xs">{r.employee_code} · {r.team_name}</div>
                </td>
                <td className="p-3 text-gray-600">{r.assessment_name}</td>
                <td className="p-3">
                  <StatusBadge status={r.completion_status} />
                </td>
                <td className="p-3 text-right font-medium">
                  {formatScore(r.official_score)}
                </td>
                <td className="p-3">
                  {(r.weak_topics ?? []).map((wt: any) => (
                    <span key={wt.topicName} className="inline-block bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded mr-1 mb-1">
                      {wt.topicName} ({wt.accuracyPct}%)
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color = 'blue' }: {
  label: string; value: string; sub: string; color?: string
}) {
  const colors: Record<string, string> = {
    blue:   'text-blue-600',
    green:  'text-green-600',
    orange: 'text-orange-500',
  }
  return (
    <div className="bg-white border rounded-lg p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pass:       { label: 'Đạt',               color: 'bg-green-100 text-green-700' },
    fail:       { label: 'Chưa đạt',          color: 'bg-red-100 text-red-700' },
    incomplete: { label: 'Không hoàn thành',  color: 'bg-orange-100 text-orange-700' },
    in_progress:{ label: 'Đang thi',          color: 'bg-yellow-100 text-yellow-700' },
    assigned:   { label: 'Chưa thi',          color: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

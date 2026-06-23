import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDeadline, formatScore } from '@/lib/utils'

export default async function LearnerDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: assignments } = await supabase
    .schema('assessment')
    .from('v_learner_dashboard')
    .select('*')

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Bài kiểm tra của tôi</h1>

      {(!assignments || assignments.length === 0) && (
        <p className="text-gray-500">Bạn chưa có bài kiểm tra nào được phân công.</p>
      )}

      <div className="space-y-4">
        {assignments?.map((a: any) => (
          <div key={a.assignment_id} className="border rounded-lg p-5 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-lg">{a.assignment_name}</h2>
                <p className="text-sm text-gray-500">{a.course_name}</p>
              </div>
              <StatusBadge status={a.recipient_status} />
            </div>

            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-gray-400">Hạn nộp</span>
                <p className="font-medium">{formatDeadline(a.personal_deadline_at)}</p>
              </div>
              {a.score !== null && (
                <div>
                  <span className="text-gray-400">Điểm</span>
                  <p className="font-medium">{formatScore(a.score)}</p>
                </div>
              )}
              {a.pass_fail && (
                <div>
                  <span className="text-gray-400">Kết quả</span>
                  <p className={`font-medium ${a.pass_fail === 'pass' ? 'text-green-600' : 'text-red-600'}`}>
                    {a.pass_fail === 'pass' ? 'Đạt' : 'Chưa đạt'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-3">
              {canStartExam(a.recipient_status, a.personal_deadline_at) && (
                <Link
                  href={`/learner/assignments/${a.assignment_id}`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                >
                  {a.recipient_status === 'assigned' ? 'Bắt đầu thi' : 'Tiếp tục'}
                </Link>
              )}
              {a.attempt_status === 'submitted' && (
                <Link
                  href={`/learner/results/${a.assignment_id}`}
                  className="inline-flex items-center px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Xem kết quả
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    assigned:    { label: 'Chưa thi',     color: 'bg-gray-100 text-gray-700' },
    in_progress: { label: 'Đang thi',     color: 'bg-yellow-100 text-yellow-700' },
    submitted:   { label: 'Đã nộp',       color: 'bg-blue-100 text-blue-700' },
    pass:        { label: 'Đạt',          color: 'bg-green-100 text-green-700' },
    fail:        { label: 'Chưa đạt',     color: 'bg-red-100 text-red-700' },
    incomplete:  { label: 'Không hoàn thành', color: 'bg-orange-100 text-orange-700' },
  }
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  )
}

function canStartExam(status: string, deadline: string): boolean {
  if (['incomplete', 'pass', 'fail'].includes(status)) return false
  if (new Date(deadline) < new Date()) return false
  return true
}

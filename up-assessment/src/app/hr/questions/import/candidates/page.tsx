import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { CandidateReviewList } from '@/components/hr/candidate-review-list'

export default async function ImportCandidatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'hr_ld', 'content_reviewer', 'system_admin')) {
    redirect('/learner/assignments')
  }

  const { data: candidates } = await supabase
    .schema('private')
    .from('import_question_candidates')
    .select(`
      id,
      import_job_id,
      parsed_stem,
      parsed_options,
      parsed_correct_answer,
      parsed_explanation,
      review_status,
      notion_page_id,
      created_at,
      raw_question_payload
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  const { data: jobs } = await supabase
    .schema('private')
    .from('import_jobs')
    .select('id, source_platform, source_title, source_url, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const jobMap: Record<string, { source_platform: string; source_title: string | null; source_url: string | null }> = {}
  for (const j of jobs ?? []) {
    jobMap[j.id] = { source_platform: j.source_platform, source_title: j.source_title, source_url: j.source_url }
  }

  const pending   = (candidates ?? []).filter(c => c.review_status === 'pending')
  const approved  = (candidates ?? []).filter(c => c.review_status === 'approved')
  const rejected  = (candidates ?? []).filter(c => c.review_status === 'rejected')

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Review Import Candidates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Xem xét câu hỏi từ NotebookLM. Approve → tự động tạo Draft trong Notion để SME xét duyệt.
        </p>
      </div>

      {/* Pipeline diagram */}
      <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 border rounded-lg p-4 overflow-x-auto">
        <Step label="Chrome Extension" done />
        <Arrow />
        <Step label="Import API" done />
        <Arrow />
        <Step label="HR Review" active />
        <Arrow />
        <Step label="Notion Draft" />
        <Arrow />
        <Step label="SME Publish" />
        <Arrow />
        <Step label="Webhook → Supabase" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Chờ review" value={pending.length}  color="yellow" />
        <StatCard label="Đã approve" value={approved.length} color="green"  />
        <StatCard label="Đã reject"  value={rejected.length} color="red"    />
      </div>

      <CandidateReviewList candidates={candidates ?? []} jobMap={jobMap} />
    </div>
  )
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  const cls = done
    ? 'bg-green-100 text-green-700 border-green-300'
    : active
    ? 'bg-blue-100 text-blue-700 border-blue-300 font-semibold'
    : 'bg-white text-gray-500 border-gray-200'
  return (
    <span className={`px-3 py-1.5 rounded-full border text-xs whitespace-nowrap ${cls}`}>
      {done ? '✓ ' : ''}{label}
    </span>
  )
}

function Arrow() {
  return <span className="text-gray-300 text-lg flex-shrink-0">→</span>
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'text-yellow-600',
    green:  'text-green-600',
    red:    'text-red-600',
  }
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>{value}</p>
    </div>
  )
}

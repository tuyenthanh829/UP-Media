import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'hr_ld', 'content_reviewer', 'system_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const candidateId = params.id

  const { data: candidate, error: fetchErr } = await supabase
    .schema('private')
    .from('import_question_candidates')
    .select('review_status')
    .eq('id', candidateId)
    .single()

  if (fetchErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  if (candidate.review_status !== 'pending') {
    return NextResponse.json({ error: 'Candidate already reviewed' }, { status: 409 })
  }

  const { error: updateErr } = await supabase
    .schema('private')
    .from('import_question_candidates')
    .update({
      review_status: 'rejected',
      reviewed_by:   user.id,
      reviewed_at:   new Date().toISOString(),
    })
    .eq('id', candidateId)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update candidate status' }, { status: 500 })
  }

  return NextResponse.json({ status: 'rejected' })
}

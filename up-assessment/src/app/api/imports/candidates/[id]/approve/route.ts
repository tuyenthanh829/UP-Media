import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { createNotionDraft } from '@/modules/integrations/notion/create-draft'
import { z } from 'zod'

const ApproveBodySchema = z.object({
  questionCode: z.string().min(1),
  courseCode:   z.string().min(1),
  topicCodes:   z.array(z.string()).min(1),
})

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

  const body = await req.json()
  const parsed = ApproveBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
  }

  const candidateId = params.id

  // Load candidate
  const { data: candidate, error: fetchErr } = await supabase
    .schema('private')
    .from('import_question_candidates')
    .select('*')
    .eq('id', candidateId)
    .single()

  if (fetchErr || !candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
  }

  if (candidate.review_status !== 'pending') {
    return NextResponse.json({ error: 'Candidate already reviewed' }, { status: 409 })
  }

  const options: { key: string; text: string }[] = candidate.parsed_options as any
  const correctKeys: string[] = candidate.parsed_correct_answer as any
  const correctKey = correctKeys[0] ?? 'A'

  const optionMap: Record<string, string> = {}
  for (const opt of options) {
    optionMap[opt.key] = opt.text
  }

  // Create Draft page in Notion
  let notionPageId: string
  try {
    notionPageId = await createNotionDraft({
      questionCode:    parsed.data.questionCode,
      courseCode:      parsed.data.courseCode,
      topicCodes:      parsed.data.topicCodes,
      questionType:    candidate.raw_question_payload?.questionType ?? 'single_choice',
      stem:            candidate.parsed_stem,
      optionA:         optionMap['A'] ?? '',
      optionB:         optionMap['B'] ?? '',
      optionC:         optionMap['C'] ?? null,
      optionD:         optionMap['D'] ?? null,
      correctOptionKey: correctKey,
      explanation:     candidate.parsed_explanation ?? null,
      importBatchId:   candidate.import_job_id,
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to create Notion draft', detail: err?.message }, { status: 502 })
  }

  // Mark candidate as approved
  const { error: updateErr } = await supabase
    .schema('private')
    .from('import_question_candidates')
    .update({
      review_status:  'approved',
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      notion_page_id: notionPageId,
    })
    .eq('id', candidateId)

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update candidate status' }, { status: 500 })
  }

  return NextResponse.json({ notionPageId, status: 'approved' })
}

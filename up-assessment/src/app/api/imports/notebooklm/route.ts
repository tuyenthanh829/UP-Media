import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const OptionSchema = z.object({
  key: z.string(),
  text: z.string(),
})

const QuestionSchema = z.object({
  sequence: z.number(),
  stem: z.string().min(5),
  questionType: z.enum(['single_choice', 'true_false']),
  options: z.array(OptionSchema).min(2).max(4),
  correctOptionKeys: z.array(z.string()).min(1),
  explanation: z.string().optional(),
})

const ImportPayloadSchema = z.object({
  sourcePlatform: z.literal('notebooklm'),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceTitle: z.string().optional(),
  parserVersion: z.string(),
  courseCode: z.string().optional(),  // sent by Chrome Extension
  questions: z.array(QuestionSchema).min(1).max(100),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = ImportPayloadSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({
      error: 'Invalid payload',
      details: parsed.error.flatten(),
    }, { status: 400 })
  }

  const payload = parsed.data

  // Create import job
  const { data: job, error: jobErr } = await supabase
    .schema('private')
    .from('import_jobs')
    .insert({
      source_platform: payload.sourcePlatform,
      source_url: payload.sourceUrl ?? null,
      source_title: payload.sourceTitle ?? null,
      initiated_by: user.id,
      parser_version: payload.parserVersion,
      status: 'received',
      total_questions_detected: payload.questions.length,
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 })
  }

  // Create candidates
  const candidates = payload.questions.map(q => ({
    import_job_id: job.id,
    raw_question_payload: q as any,
    parsed_stem: q.stem,
    parsed_options: q.options,
    parsed_correct_answer: q.correctOptionKeys,
    parsed_explanation: q.explanation ?? null,
    confidence_score: 95.00,
    validation_status: 'valid' as const,
    review_status: 'pending' as const,
  }))

  await supabase
    .schema('private')
    .from('import_question_candidates')
    .insert(candidates)

  // Update job status
  await supabase
    .schema('private')
    .from('import_jobs')
    .update({ status: 'imported' })
    .eq('id', job.id)

  return NextResponse.json({
    importJobId: job.id,
    questionsReceived: payload.questions.length,
    status: 'imported',
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const AutosaveSchema = z.object({
  answers: z.array(z.object({
    attemptItemId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()),
  })),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = AutosaveSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  // Verify attempt belongs to user and is in_progress
  const { data: attempt } = await supabase
    .schema('assessment')
    .from('attempts')
    .select('id, status, user_id')
    .eq('id', attemptId)
    .single()

  if (!attempt || attempt.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (attempt.status !== 'in_progress') {
    return NextResponse.json({ error: 'Attempt is not in progress' }, { status: 400 })
  }

  // Upsert answers (is_final = false)
  const upserts = parsed.data.answers.map(a => ({
    attempt_item_id: a.attemptItemId,
    selected_option_ids: a.selectedOptionIds,
    is_final: false,
    saved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  await supabase
    .schema('assessment')
    .from('attempt_answers')
    .upsert(upserts, { onConflict: 'attempt_item_id' })

  return NextResponse.json({ saved: true, savedAt: new Date().toISOString() })
}

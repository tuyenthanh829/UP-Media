'use server'

import { createClient } from '@/lib/supabase/server'
import type { AttemptItem, OptionSnapshot, TopicSnapshot } from '@/types/database'

interface StartAttemptResult {
  attemptId: string
  expiresAt: string
  durationMinutes: number
  items: AttemptItem[]
}

export async function startAttempt(assignmentId: string): Promise<StartAttemptResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Chưa đăng nhập')

  // Get recipient
  const { data: recipient, error: rErr } = await supabase
    .schema('assessment')
    .from('assignment_recipients')
    .select('id, personal_deadline_at, first_valid_attempt_id, assignment_id')
    .eq('assignment_id', assignmentId)
    .eq('user_id', user.id)
    .single()

  if (rErr || !recipient) throw new Error('Bạn không được phân công bài kiểm tra này')

  // Check deadline
  if (new Date(recipient.personal_deadline_at) < new Date()) {
    throw new Error('Đã hết hạn nộp bài')
  }

  // Get exam template version details
  const { data: assignment } = await supabase
    .schema('assessment')
    .from('assignments')
    .select(`
      exam_template_version_id,
      exam_template_versions!inner(
        duration_minutes,
        questions_to_draw,
        randomize_questions,
        randomize_options,
        total_score,
        passing_score_snapshot,
        exam_template_question_pool(
          id, question_version_id, score_weight, is_required, selection_group,
          question_versions!inner(
            id, stem, question_type, question_options(id, option_text, canonical_key, canonical_order, is_correct),
            question_topics(topic_id, topics(id, name))
          )
        )
      )
    `)
    .eq('id', assignmentId)
    .single()

  if (!assignment) throw new Error('Không tìm thấy bài kiểm tra')

  const etv = (assignment as any).exam_template_versions
  const pool = etv.exam_template_question_pool as any[]

  // Draw questions
  let drawn = [...pool]
  if (etv.randomize_questions) {
    drawn = drawn.sort(() => Math.random() - 0.5)
  }
  drawn = drawn.slice(0, etv.questions_to_draw)

  const expiresAt = new Date(Date.now() + etv.duration_minutes * 60 * 1000).toISOString()

  // Determine attempt_no
  const { count } = await supabase
    .schema('assessment')
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_recipient_id', recipient.id)

  const attemptNo = (count ?? 0) + 1
  const attemptMode = recipient.first_valid_attempt_id ? 'practice' : 'official'

  // Create attempt
  const { data: attempt, error: aErr } = await supabase
    .schema('assessment')
    .from('attempts')
    .insert({
      assignment_recipient_id: recipient.id,
      user_id: user.id,
      attempt_no: attemptNo,
      attempt_mode: attemptMode,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      total_score: etv.total_score,
    })
    .select('id')
    .single()

  if (aErr || !attempt) throw new Error('Không thể tạo lượt thi')

  // Build attempt_items — options_snapshot has NO is_correct
  const itemInserts: any[] = []
  const answerKeyInserts: any[] = []

  drawn.forEach((poolItem: any, idx: number) => {
    const qv = poolItem.question_versions
    let options = [...qv.question_options]

    if (etv.randomize_options) {
      options = options.sort(() => Math.random() - 0.5)
    }

    const optionsSnapshot: OptionSnapshot[] = options.map((o: any, i: number) => ({
      option_id: o.id,
      display_order: i + 1,
      option_text: o.option_text,
      // is_correct intentionally omitted
    }))

    const topicSnapshot: TopicSnapshot[] = (qv.question_topics ?? []).map((qt: any) => ({
      topic_id: qt.topic_id,
      topic_name: qt.topics?.name ?? '',
    }))

    const correctOptionIds = options.filter((o: any) => o.is_correct).map((o: any) => o.id)

    itemInserts.push({
      attempt_id: attempt.id,
      question_version_id: qv.id,
      question_stem_snapshot: qv.stem,
      question_type_snapshot: qv.question_type,
      options_snapshot: optionsSnapshot,
      topic_snapshot: topicSnapshot,
      display_order: idx + 1,
      score_weight: poolItem.score_weight,
      is_required: poolItem.is_required,
    })

    answerKeyInserts.push({ correctOptionIds, display_order: idx + 1 })
  })

  const { data: createdItems, error: iErr } = await supabase
    .schema('assessment')
    .from('attempt_items')
    .insert(itemInserts)
    .select('id, display_order')

  if (iErr || !createdItems) throw new Error('Không thể tạo đề thi')

  // Insert answer keys into private schema (server-only, never returned to client)
  const keyInserts = createdItems.map((item: any) => {
    const key = answerKeyInserts.find((k: any) => k.display_order === item.display_order)
    return {
      attempt_item_id: item.id,
      correct_option_ids: key!.correctOptionIds,
      grading_rule_snapshot: { rule: 'exact_match' },
    }
  })

  await supabase
    .schema('private')
    .from('attempt_answer_keys')
    .insert(keyInserts)

  // Update recipient status
  await supabase
    .schema('assessment')
    .from('assignment_recipients')
    .update({ recipient_status: 'in_progress' })
    .eq('id', recipient.id)

  // Return to client — no answer keys included
  const { data: items } = await supabase
    .schema('assessment')
    .from('attempt_items')
    .select('*')
    .eq('attempt_id', attempt.id)
    .order('display_order')

  return {
    attemptId: attempt.id,
    expiresAt,
    durationMinutes: etv.duration_minutes,
    items: items as AttemptItem[],
  }
}

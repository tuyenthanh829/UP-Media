'use server'

import { createClient } from '@/lib/supabase/server'
import type { GradingResult } from '@/types/database'

export async function submitAttempt(attemptId: string): Promise<GradingResult> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .schema('assessment')
    .rpc('submit_and_grade_attempt', { p_attempt_id: attemptId })

  if (error) {
    // Never leak internal error details — log server-side, return safe message
    console.error('[submitAttempt] grading error:', error.message)
    throw new Error('Không thể nộp bài. Vui lòng thử lại.')
  }

  return data as GradingResult
}

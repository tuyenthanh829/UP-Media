import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { getNotionClient, getQuestionBankDatabaseId } from './client'
import { parseNotionPage } from './parser'
import type { NotionQuestionPage, SyncResult } from './types'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// ---------------------------------------------------------------
// Fetch all Published pages from Notion Question Bank
// ---------------------------------------------------------------
export async function fetchPublishedNotionPages(): Promise<PageObjectResponse[]> {
  const notion = getNotionClient()
  const dbId   = getQuestionBankDatabaseId()
  const pages: PageObjectResponse[] = []
  let cursor: string | undefined

  do {
    // @notionhq/client v5: query moved from databases.query → dataSources.query
    const response = await (notion as any).dataSources.query({
      database_id: dbId,
      filter: {
        property: 'Status',
        select: { equals: 'Published' },
      },
      start_cursor: cursor,
      page_size: 100,
    })

    for (const page of response.results) {
      if (page.object === 'page') {
        pages.push(page as PageObjectResponse)
      }
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return pages
}

// ---------------------------------------------------------------
// Fetch a single page by ID (used by webhook handler)
// ---------------------------------------------------------------
export async function fetchNotionPageById(pageId: string): Promise<PageObjectResponse | null> {
  try {
    const notion = getNotionClient()
    const page = await notion.pages.retrieve({ page_id: pageId })
    if (page.object === 'page') return page as PageObjectResponse
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------
// Compute a stable content hash for duplicate detection
// ---------------------------------------------------------------
function computeContentHash(q: NotionQuestionPage): string {
  const payload = JSON.stringify({
    stem: q.stem,
    a: q.optionA,
    b: q.optionB,
    c: q.optionC,
    d: q.optionD,
    correct: q.correctOptionKey,
  })
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

// ---------------------------------------------------------------
// Validate a parsed page has all required fields
// ---------------------------------------------------------------
function validatePage(q: NotionQuestionPage): string | null {
  if (!q.questionCode)    return 'Missing Question Code'
  if (!q.stem)            return 'Missing Question Content'
  if (!q.questionType)    return 'Invalid or missing Question Type'
  if (!q.optionA || !q.optionB) return 'Need at least Option A and B'
  if (!q.correctOptionKey) return 'Missing Correct Option'
  if (q.questionType === 'true_false' && (q.optionC || q.optionD)) {
    return 'true_false must have exactly 2 options (A and B only)'
  }
  return null
}

// ---------------------------------------------------------------
// Sync a single Notion page into Supabase
// ---------------------------------------------------------------
export async function syncOnePage(q: NotionQuestionPage): Promise<SyncResult> {
  const base: SyncResult = { notionPageId: q.notionPageId, questionCode: q.questionCode, action: 'failed' }

  const validationError = validatePage(q)
  if (validationError) {
    await logSyncResult(q.notionPageId, null, 'failed', validationError)
    return { ...base, action: 'failed', reason: validationError }
  }

  const supabase = createAdminClient()
  const contentHash = q.contentHash ?? computeContentHash(q)

  // 1. Resolve course_id from course_code
  const { data: course } = await supabase
    .schema('content')
    .from('courses')
    .select('id')
    .eq('course_code', q.courseCode!)
    .single()

  if (!course) {
    const reason = `Course not found: ${q.courseCode}`
    await logSyncResult(q.notionPageId, null, 'failed', reason)
    return { ...base, action: 'failed', reason }
  }

  // 2. Find or create question identity record
  const { data: existing } = await supabase
    .schema('content')
    .from('questions')
    .select('id, current_version_no')
    .eq('notion_page_id', q.notionPageId)
    .single()

  let questionId: string
  let nextVersionNo: number

  if (!existing) {
    // New question
    const { data: newQ, error } = await supabase
      .schema('content')
      .from('questions')
      .insert({
        question_code:      q.questionCode!,
        course_id:          course.id,
        source_type:        'notebooklm',
        notion_page_id:     q.notionPageId,
        status:             'published',
        current_version_no: 1,
      })
      .select('id')
      .single()

    if (error || !newQ) {
      const reason = `Failed to create question: ${error?.message}`
      await logSyncResult(q.notionPageId, null, 'failed', reason)
      return { ...base, action: 'failed', reason }
    }

    questionId    = newQ.id
    nextVersionNo = 1
  } else {
    // Check if content changed (avoid duplicate versions)
    const { data: latestVersion } = await supabase
      .schema('content')
      .from('question_versions')
      .select('content_hash')
      .eq('question_id', existing.id)
      .eq('version_no', existing.current_version_no)
      .single()

    if (latestVersion?.content_hash === contentHash) {
      await logSyncResult(q.notionPageId, existing.id, 'skipped', 'Content unchanged')
      return { ...base, action: 'skipped', reason: 'Content unchanged' }
    }

    questionId    = existing.id
    nextVersionNo = existing.current_version_no + 1
  }

  // 3. Create immutable question version
  const { data: version, error: vErr } = await supabase
    .schema('content')
    .from('question_versions')
    .insert({
      question_id:    questionId,
      version_no:     nextVersionNo,
      question_type:  q.questionType!,
      stem:           q.stem!,
      explanation:    q.explanation ?? null,
      difficulty:     q.difficulty ?? 'medium',
      language_code:  'vi-VN',
      source_reference: q.sourceReference ?? null,
      content_hash:   contentHash,
      review_status:  'published',
      published_at:   new Date().toISOString(),
    })
    .select('id')
    .single()

  if (vErr || !version) {
    const reason = `Failed to create question version: ${vErr?.message}`
    await logSyncResult(q.notionPageId, questionId, 'failed', reason)
    return { ...base, action: 'failed', reason }
  }

  // 4. Create options — map key → is_correct
  const options = buildOptions(q)
  if (options.length < 2) {
    const reason = 'Not enough valid options (need at least A and B)'
    await logSyncResult(q.notionPageId, questionId, 'failed', reason)
    return { ...base, action: 'failed', reason }
  }

  const { error: optErr } = await supabase
    .schema('content')
    .from('question_options')
    .insert(options.map((o, i) => ({
      question_version_id: version.id,
      canonical_key:       o.key,
      option_text:         o.text,
      is_correct:          o.key === q.correctOptionKey,
      canonical_order:     i + 1,
    })))

  if (optErr) {
    const reason = `Failed to insert options: ${optErr.message}`
    await logSyncResult(q.notionPageId, questionId, 'failed', reason)
    return { ...base, action: 'failed', reason }
  }

  // 5. Resolve and attach topics
  if (q.topicCodes.length > 0) {
    const { data: topics } = await supabase
      .schema('content')
      .from('topics')
      .select('id, code')
      .in('code', q.topicCodes)
      .eq('course_id', course.id)

    if (topics && topics.length > 0) {
      await supabase
        .schema('content')
        .from('question_topics')
        .insert(topics.map((t, i) => ({
          question_version_id: version.id,
          topic_id:            t.id,
          is_primary_topic:    i === 0,
          weight:              1.00,
        })))
    }
  }

  // 6. Update question's current_version_no
  await supabase
    .schema('content')
    .from('questions')
    .update({ current_version_no: nextVersionNo, status: 'published' })
    .eq('id', questionId)

  const action = nextVersionNo === 1 ? 'created' : 'version_bumped'
  await logSyncResult(q.notionPageId, questionId, 'success', undefined, nextVersionNo)

  return { ...base, action }
}

// ---------------------------------------------------------------
// Full sync: fetch all Published pages and sync each one
// ---------------------------------------------------------------
export async function runFullSync(): Promise<{
  total: number
  created: number
  version_bumped: number
  skipped: number
  failed: number
  results: SyncResult[]
}> {
  const pages   = await fetchPublishedNotionPages()
  const results: SyncResult[] = []

  for (const page of pages) {
    const parsed = parseNotionPage(page)
    const result = await syncOnePage(parsed)
    results.push(result)
  }

  return {
    total:         results.length,
    created:       results.filter(r => r.action === 'created').length,
    version_bumped:results.filter(r => r.action === 'version_bumped').length,
    skipped:       results.filter(r => r.action === 'skipped').length,
    failed:        results.filter(r => r.action === 'failed').length,
    results,
  }
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function buildOptions(q: NotionQuestionPage): { key: string; text: string }[] {
  const candidates = [
    { key: 'A', text: q.optionA },
    { key: 'B', text: q.optionB },
    { key: 'C', text: q.optionC },
    { key: 'D', text: q.optionD },
  ]
  return candidates.filter((o): o is { key: string; text: string } => o.text !== null && o.text.trim() !== '')
}

async function logSyncResult(
  notionPageId: string,
  questionId: string | null,
  status: 'success' | 'skipped' | 'failed',
  errorDetail?: string,
  targetVersion?: number,
) {
  try {
    const supabase = createAdminClient()
    await supabase
      .schema('private')
      .from('notion_sync_logs')
      .insert({
        notion_page_id:  notionPageId,
        question_id:     questionId ?? undefined,
        sync_direction:  'notion_to_supabase',
        sync_status:     status,
        target_version:  targetVersion ?? null,
        error_detail:    errorDetail ?? null,
        synced_at:       new Date().toISOString(),
      })
  } catch {
    // Log failure should never crash the sync
  }
}

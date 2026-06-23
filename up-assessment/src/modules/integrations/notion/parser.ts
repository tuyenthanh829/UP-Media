import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionQuestionPage } from './types'
import type { QuestionType, DifficultyLevel } from '@/types/database'

// Extract plain text from Notion rich_text / title arrays
function richText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return value.map((t: any) => t.plain_text ?? '').join('').trim() || null
}

function selectValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const v = value as any
  return v.select?.name ?? null
}

function multiSelectValues(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  const v = value as any
  return (v.multi_select ?? []).map((s: any) => s.name as string)
}

function urlValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const v = value as any
  return v.url ?? null
}

function numberValue(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const v = value as any
  return typeof v.number === 'number' ? v.number : null
}

function relationValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const v = value as any
  if (!Array.isArray(v.relation) || v.relation.length === 0) return null
  // Return first relation title (name)
  return v.relation[0]?.id ?? null
}

function personName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const v = value as any
  const people = v.people ?? []
  if (people.length === 0) return null
  return people[0]?.name ?? null
}

const QUESTION_TYPE_MAP: Record<string, QuestionType> = {
  'Single Choice':  'single_choice',
  'single_choice':  'single_choice',
  'True/False':     'true_false',
  'true_false':     'true_false',
}

const DIFFICULTY_MAP: Record<string, DifficultyLevel> = {
  'Dễ':   'easy',
  'Easy':  'easy',
  'Trung bình': 'medium',
  'Medium': 'medium',
  'Khó':   'hard',
  'Hard':  'hard',
}

export function parseNotionPage(page: PageObjectResponse): NotionQuestionPage {
  const props = page.properties

  const questionTypeRaw = selectValue(props['Question Type'])
  const difficultyRaw   = selectValue(props['Difficulty'])
  const statusRaw       = selectValue(props['Status'])
  const correctRaw      = selectValue(props['Correct Option'])

  return {
    notionPageId:    page.id,
    questionCode:    richText(props['Question Code']),
    // Course and Topic are relations — store their code/name from multi-select fallback
    courseCode:      selectValue(props['Course']) ?? richText(props['Course']),
    topicCodes:      multiSelectValues(props['Topic']),
    questionType:    questionTypeRaw ? (QUESTION_TYPE_MAP[questionTypeRaw] ?? null) : null,
    stem:            richText(props['Question Content']),
    optionA:         richText(props['Option A']),
    optionB:         richText(props['Option B']),
    optionC:         richText(props['Option C']),
    optionD:         richText(props['Option D']),
    correctOptionKey: correctRaw ? correctRaw.toUpperCase() : null,
    explanation:     richText(props['Explanation']),
    difficulty:      difficultyRaw ? (DIFFICULTY_MAP[difficultyRaw] ?? 'medium') : 'medium',
    sourceReference: urlValue(props['Source']),
    importBatchId:   richText(props['Import Batch ID']),
    status:          statusRaw,
    reviewerName:    personName(props['Reviewer']),
    versionNo:       numberValue(props['Version']),
    contentHash:     richText(props['Content Hash']),
  }
}

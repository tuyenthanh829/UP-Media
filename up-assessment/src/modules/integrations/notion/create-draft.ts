import { getNotionClient, getQuestionBankDatabaseId } from './client'

interface CandidateDraftInput {
  questionCode:    string
  courseCode:      string
  topicCodes:      string[]
  questionType:    string
  stem:            string
  optionA:         string
  optionB:         string
  optionC?:        string | null
  optionD?:        string | null
  correctOptionKey: string   // 'A'|'B'|'C'|'D'
  explanation?:    string | null
  importBatchId:   string
}

// Create a Draft page in Notion Question Bank from an approved import candidate
export async function createNotionDraft(input: CandidateDraftInput): Promise<string> {
  const notion = getNotionClient()
  const dbId   = getQuestionBankDatabaseId()

  const response = await notion.pages.create({
    parent: { database_id: dbId },
    properties: buildNotionProperties(input),
  })

  return response.id
}

function buildNotionProperties(input: CandidateDraftInput): Record<string, unknown> {
  const questionTypeLabel: Record<string, string> = {
    single_choice: 'Single Choice',
    true_false:    'True/False',
  }

  return {
    // Title = Question Code
    'Question Code': {
      title: [{ text: { content: input.questionCode } }],
    },
    'Course': {
      select: { name: input.courseCode },
    },
    'Topic': {
      multi_select: input.topicCodes.map(t => ({ name: t })),
    },
    'Question Type': {
      select: { name: questionTypeLabel[input.questionType] ?? 'Single Choice' },
    },
    'Question Content': {
      rich_text: [{ text: { content: input.stem } }],
    },
    'Option A': {
      rich_text: [{ text: { content: input.optionA } }],
    },
    'Option B': {
      rich_text: [{ text: { content: input.optionB } }],
    },
    ...(input.optionC ? {
      'Option C': { rich_text: [{ text: { content: input.optionC } }] },
    } : {}),
    ...(input.optionD ? {
      'Option D': { rich_text: [{ text: { content: input.optionD } }] },
    } : {}),
    'Correct Option': {
      select: { name: input.correctOptionKey },
    },
    ...(input.explanation ? {
      'Explanation': { rich_text: [{ text: { content: input.explanation } }] },
    } : {}),
    'Status': {
      select: { name: 'Draft' },
    },
    'Import Batch ID': {
      rich_text: [{ text: { content: input.importBatchId } }],
    },
  }
}

import type { QuestionType, DifficultyLevel } from '@/types/database'

// Raw property values parsed from a Notion page
export interface NotionQuestionPage {
  notionPageId: string
  questionCode: string | null
  courseCode: string | null
  topicCodes: string[]
  questionType: QuestionType | null
  stem: string | null
  optionA: string | null
  optionB: string | null
  optionC: string | null
  optionD: string | null
  correctOptionKey: string | null   // 'A' | 'B' | 'C' | 'D'
  explanation: string | null
  difficulty: DifficultyLevel | null
  sourceReference: string | null
  importBatchId: string | null
  status: string | null             // Draft / In Review / Published / Retired
  reviewerName: string | null
  versionNo: number | null
  contentHash: string | null
}

export interface SyncResult {
  notionPageId: string
  questionCode: string | null
  action: 'created' | 'version_bumped' | 'skipped' | 'failed'
  reason?: string
}

import { Client } from '@notionhq/client'

// Notion client — server-side only, never instantiate in browser
export function getNotionClient(): Client {
  const token = process.env.NOTION_INTEGRATION_TOKEN
  if (!token) throw new Error('NOTION_INTEGRATION_TOKEN is not set')
  return new Client({ auth: token })
}

export function getQuestionBankDatabaseId(): string {
  const id = process.env.NOTION_QUESTION_BANK_DATABASE_ID
  if (!id) throw new Error('NOTION_QUESTION_BANK_DATABASE_ID is not set')
  return id
}

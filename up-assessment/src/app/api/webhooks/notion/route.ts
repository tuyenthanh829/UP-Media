import { NextRequest, NextResponse } from 'next/server'
import { fetchNotionPageById } from '@/modules/integrations/notion/sync'
import { parseNotionPage } from '@/modules/integrations/notion/parser'
import { syncOnePage } from '@/modules/integrations/notion/sync'
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'

// Notion webhooks are not GA yet — this handler supports the
// "automation → HTTP request" pattern where Notion sends the page_id
// when a page's Status changes to "Published".
//
// Expected payload: { page_id: "notion-page-uuid" }
// Secure with a shared secret in the Notion automation URL.

const WEBHOOK_SECRET = process.env.NOTION_WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  // Always require the secret — return 401 if env var is missing or value doesn't match
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 401 })
  }
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const pageId = (body as any)?.page_id
  if (!pageId || typeof pageId !== 'string') {
    return NextResponse.json({ error: 'Missing page_id' }, { status: 400 })
  }

  const page = await fetchNotionPageById(pageId)
  if (!page) {
    return NextResponse.json({ error: 'Page not found or not accessible' }, { status: 404 })
  }

  const parsed = parseNotionPage(page as PageObjectResponse)

  // Only sync if status is Published
  if (parsed.status !== 'Published') {
    return NextResponse.json({
      synced: false,
      reason: `Page status is "${parsed.status}", skipping`,
    })
  }

  const result = await syncOnePage(parsed)

  return NextResponse.json({ synced: true, result })
}

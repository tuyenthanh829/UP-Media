import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Returns the current user's Supabase access token so the Chrome Extension
// can use it as the Bearer token for import API calls.
// The token is a short-lived JWT — user must refresh if it expires.
export async function GET() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    accessToken: session.access_token,
    expiresAt:   session.expires_at,
  })
}

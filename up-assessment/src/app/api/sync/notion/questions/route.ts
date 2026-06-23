import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { runFullSync } from '@/modules/integrations/notion/sync'

// Manual full sync — only HR/L&D or system_admin can trigger
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'hr_ld', 'system_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const summary = await runFullSync()
    return NextResponse.json(summary)
  } catch (err: any) {
    // Log server-side but return safe message
    console.error('[notion-sync] full sync error:', err.message)
    return NextResponse.json({ error: 'Sync failed. Check server logs.' }, { status: 500 })
  }
}

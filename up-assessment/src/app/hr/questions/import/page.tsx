import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserRoles, hasRole } from '@/lib/permissions/roles'
import { NotionSyncButton } from '@/components/hr/notion-sync-button'

export default async function QuestionImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const roles = await getUserRoles(user.id)
  if (!hasRole(roles, 'hr_ld', 'content_reviewer', 'system_admin')) {
    redirect('/learner/assignments')
  }

  // Recent sync logs
  const { data: logs } = await supabase
    .schema('private')
    .from('notion_sync_logs')
    .select('notion_page_id, sync_status, sync_direction, error_detail, target_version, synced_at')
    .order('synced_at', { ascending: false })
    .limit(50)

  const successCount = logs?.filter(l => l.sync_status === 'success').length ?? 0
  const failedCount  = logs?.filter(l => l.sync_status === 'failed').length ?? 0
  const skippedCount = logs?.filter(l => l.sync_status === 'skipped').length ?? 0

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notion Question Sync</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sync câu hỏi có trạng thái <strong>Published</strong> từ Notion Question Bank vào Supabase.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/hr/questions/import/candidates"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
          >
            Review Import Candidates →
          </Link>
          <NotionSyncButton />
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-sm space-y-2">
        <p className="font-semibold text-blue-800">Cách hoạt động</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Review câu hỏi trong Notion, đổi Status thành <strong>Published</strong></li>
          <li>Nhấn <strong>Sync Now</strong> hoặc chờ Notion automation trigger webhook</li>
          <li>Hệ thống tạo immutable question version trong Supabase</li>
          <li>Câu hỏi sẵn sàng để thêm vào exam template</li>
        </ol>
        <p className="text-blue-600 mt-2">
          ⚠️ Nếu nội dung câu hỏi thay đổi sau khi Published, hệ thống tự tạo version mới —
          các attempt cũ vẫn giữ nguyên snapshot cũ.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Synced thành công" value={successCount} color="green" />
        <StatCard label="Skipped (không đổi)" value={skippedCount} color="gray" />
        <StatCard label="Failed" value={failedCount} color="red" />
      </div>

      {/* Sync log table */}
      <div>
        <h2 className="font-semibold mb-3">Sync Log gần đây</h2>
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Notion Page ID</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Version</th>
                <th className="text-left p-3 font-medium">Thời gian</th>
                <th className="text-left p-3 font-medium">Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(logs ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-400">
                    Chưa có sync log nào
                  </td>
                </tr>
              )}
              {(logs ?? []).map((log, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs text-gray-500">
                    {log.notion_page_id.slice(0, 8)}...
                  </td>
                  <td className="p-3">
                    <SyncStatusBadge status={log.sync_status} />
                  </td>
                  <td className="p-3 text-gray-600">
                    {log.target_version ? `v${log.target_version}` : '—'}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {new Date(log.synced_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </td>
                  <td className="p-3 text-xs text-red-500">
                    {log.error_detail ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    gray:  'text-gray-500',
    red:   'text-red-600',
  }
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color]}`}>{value}</p>
    </div>
  )
}

function SyncStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    success: { label: 'Success', color: 'bg-green-100 text-green-700' },
    skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-600' },
    failed:  { label: 'Failed',  color: 'bg-red-100 text-red-700' },
  }
  const s = map[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
}

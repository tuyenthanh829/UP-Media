'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface SyncSummary {
  total: number
  created: number
  version_bumped: number
  skipped: number
  failed: number
}

export function NotionSyncButton() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [summary, setSummary]   = useState<SyncSummary | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setSummary(null)
    setError(null)

    try {
      const res = await fetch('/api/sync/notion/questions', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Sync thất bại')
        return
      }

      setSummary(data as SyncSummary)
      router.refresh()
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-right space-y-2">
      <Button onClick={handleSync} disabled={loading}>
        {loading ? 'Đang sync...' : '🔄 Sync Now'}
      </Button>

      {summary && (
        <div className="text-xs bg-green-50 border border-green-200 rounded p-3 text-left space-y-0.5">
          <p className="font-semibold text-green-800">Sync hoàn tất</p>
          <p className="text-green-700">Tổng: {summary.total} · Mới: {summary.created} · Updated: {summary.version_bumped} · Skipped: {summary.skipped} · Lỗi: {summary.failed}</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}
    </div>
  )
}

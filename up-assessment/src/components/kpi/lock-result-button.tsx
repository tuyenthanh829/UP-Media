'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { lockResult } from '@/modules/results/confirm-lock'
import { Button } from '@/components/ui/button'

export function LockResultButton({ resultId }: { resultId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLock() {
    if (!confirm('Khóa kết quả KPI này? Sau khi khóa sẽ không thể chỉnh sửa trực tiếp.')) return
    setLoading(true)
    setError(null)
    try {
      await lockResult(resultId)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button size="sm" variant="destructive" onClick={handleLock} disabled={loading}>
        {loading ? 'Đang khóa...' : 'Khóa KPI 🔒'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmResult } from '@/modules/results/confirm-lock'
import { Button } from '@/components/ui/button'

export function ConfirmResultButton({ resultId }: { resultId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!confirm('Xác nhận kết quả này? Hành động này sẽ được ghi log.')) return
    setLoading(true)
    setError(null)
    try {
      await confirmResult(resultId)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button size="sm" onClick={handleConfirm} disabled={loading}>
        {loading ? 'Đang xác nhận...' : 'Xác nhận'}
      </Button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

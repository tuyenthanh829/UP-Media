'use client'

import { useState } from 'react'

interface Option { key: string; text: string }

interface Candidate {
  id: string
  import_job_id: string
  parsed_stem: string | null
  parsed_options: unknown
  parsed_correct_answer: unknown
  parsed_explanation: string | null
  review_status: string
  notion_page_id: string | null
  created_at: string
  raw_question_payload: unknown
}

interface JobInfo {
  source_platform: string
  source_title: string | null
  source_url: string | null
}

interface Props {
  candidates: Candidate[]
  jobMap: Record<string, JobInfo>
}

type LocalStatus = 'pending' | 'approved' | 'rejected' | 'loading'

interface ApproveForm {
  questionCode: string
  courseCode: string
  topicCodes: string
}

export function CandidateReviewList({ candidates, jobMap }: Props) {
  const [statuses, setStatuses] = useState<Record<string, LocalStatus>>({})
  const [forms, setForms] = useState<Record<string, ApproveForm>>({})
  const [notionLinks, setNotionLinks] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')

  const getStatus = (c: Candidate): LocalStatus =>
    (statuses[c.id] ?? c.review_status) as LocalStatus

  const getForm = (id: string): ApproveForm =>
    forms[id] ?? { questionCode: '', courseCode: '', topicCodes: '' }

  const updateForm = (id: string, field: keyof ApproveForm, value: string) => {
    setForms(prev => ({ ...prev, [id]: { ...getForm(id), [field]: value } }))
  }

  const handleApprove = async (candidate: Candidate) => {
    const form = getForm(candidate.id)
    if (!form.questionCode.trim() || !form.courseCode.trim() || !form.topicCodes.trim()) {
      setErrors(prev => ({ ...prev, [candidate.id]: 'Vui lòng điền đầy đủ Question Code, Course Code và Topic Codes.' }))
      return
    }
    setErrors(prev => ({ ...prev, [candidate.id]: '' }))
    setStatuses(prev => ({ ...prev, [candidate.id]: 'loading' }))

    const res = await fetch(`/api/imports/candidates/${candidate.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionCode: form.questionCode.trim(),
        courseCode:   form.courseCode.trim(),
        topicCodes:   form.topicCodes.split(',').map(t => t.trim()).filter(Boolean),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setStatuses(prev => ({ ...prev, [candidate.id]: 'approved' }))
      if (data.notionPageId) {
        setNotionLinks(prev => ({ ...prev, [candidate.id]: data.notionPageId }))
      }
    } else {
      const data = await res.json().catch(() => ({}))
      setErrors(prev => ({ ...prev, [candidate.id]: data.error ?? 'Approve thất bại' }))
      setStatuses(prev => ({ ...prev, [candidate.id]: 'pending' }))
    }
  }

  const handleReject = async (candidateId: string) => {
    setStatuses(prev => ({ ...prev, [candidateId]: 'loading' }))
    const res = await fetch(`/api/imports/candidates/${candidateId}/reject`, { method: 'POST' })
    if (res.ok) {
      setStatuses(prev => ({ ...prev, [candidateId]: 'rejected' }))
    } else {
      setStatuses(prev => ({ ...prev, [candidateId]: 'pending' }))
    }
  }

  const filtered = candidates.filter(c => {
    const s = getStatus(c)
    if (filter === 'all') return true
    return s === filter
  })

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === f
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {f === 'pending' ? 'Chờ review' : f === 'approved' ? 'Đã approve' : f === 'rejected' ? 'Đã reject' : 'Tất cả'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 border rounded-lg">
          Không có câu hỏi nào
        </div>
      )}

      {filtered.map(candidate => {
        const status = getStatus(candidate)
        const options = (candidate.parsed_options as Option[] | null) ?? []
        const correctKeys = (candidate.parsed_correct_answer as string[] | null) ?? []
        const job = jobMap[candidate.import_job_id]
        const form = getForm(candidate.id)
        const qType: string = (candidate.raw_question_payload as any)?.questionType ?? 'single_choice'

        return (
          <div
            key={candidate.id}
            className={`border rounded-lg p-5 space-y-4 ${
              status === 'approved' ? 'border-green-200 bg-green-50/30' :
              status === 'rejected' ? 'border-red-200 bg-red-50/30 opacity-60' :
              'border-gray-200 bg-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={status} />
                  <span className="text-xs text-gray-400">
                    {new Date(candidate.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
                  </span>
                  {job && (
                    <span className="text-xs text-gray-400">
                      · {job.source_platform}{job.source_title ? ` — ${job.source_title}` : ''}
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {qType === 'true_false' ? 'True/False' : 'Single Choice'}
                  </span>
                </div>
                <p className="font-medium text-gray-900">{candidate.parsed_stem ?? '(no stem)'}</p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1.5 pl-1">
              {options.map(opt => (
                <div
                  key={opt.key}
                  className={`flex gap-2 text-sm rounded px-3 py-2 ${
                    correctKeys.includes(opt.key)
                      ? 'bg-green-100 text-green-800 font-medium'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-bold w-5 flex-shrink-0">{opt.key}.</span>
                  <span>{opt.text}</span>
                  {correctKeys.includes(opt.key) && (
                    <span className="ml-auto text-green-600 text-xs">✓ Correct</span>
                  )}
                </div>
              ))}
            </div>

            {/* Explanation */}
            {candidate.parsed_explanation && (
              <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded p-3">
                <strong>Giải thích:</strong> {candidate.parsed_explanation}
              </div>
            )}

            {/* Approve form (only when pending) */}
            {status === 'pending' && (
              <div className="border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Question Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="vd: ACC-T01-001"
                      value={form.questionCode}
                      onChange={e => updateForm(candidate.id, 'questionCode', e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">
                      Course Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="vd: ACCOUNT-BASIC"
                      value={form.courseCode}
                      onChange={e => updateForm(candidate.id, 'courseCode', e.target.value)}
                      className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Topic Codes <span className="text-red-500">*</span>
                    <span className="text-gray-400 font-normal"> (phân cách bằng dấu phẩy)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="vd: DEBIT-CREDIT, JOURNAL-ENTRY"
                    value={form.topicCodes}
                    onChange={e => updateForm(candidate.id, 'topicCodes', e.target.value)}
                    className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                {errors[candidate.id] && (
                  <p className="text-xs text-red-600">{errors[candidate.id]}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(candidate)}
                    disabled={status === 'loading'}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {status === 'loading' ? 'Đang xử lý...' : '✓ Approve → Tạo Notion Draft'}
                  </button>
                  <button
                    onClick={() => handleReject(candidate.id)}
                    disabled={status === 'loading'}
                    className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            )}

            {/* Approved state */}
            {status === 'approved' && (
              <div className="border-t pt-3 flex items-center gap-3 text-sm text-green-700">
                <span>✓ Đã tạo Notion Draft</span>
                {(notionLinks[candidate.id] ?? candidate.notion_page_id) && (
                  <span className="text-xs font-mono text-green-600">
                    ID: {(notionLinks[candidate.id] ?? candidate.notion_page_id)?.slice(0, 8)}...
                  </span>
                )}
                <span className="text-xs text-gray-400">Chờ SME publish trong Notion để sync vào hệ thống</span>
              </div>
            )}

            {/* Rejected state */}
            {status === 'rejected' && (
              <div className="border-t pt-3 text-sm text-red-500">✕ Đã reject</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
    loading:  { label: 'Loading…', cls: 'bg-gray-100 text-gray-500' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

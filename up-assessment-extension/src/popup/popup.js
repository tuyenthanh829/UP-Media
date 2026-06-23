// Popup controller — manages UI state, scan triggers, preview, submit
// No secrets stored here. API calls go through background.js.

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
let questions = []  // Array of parsed question objects

// ----------------------------------------------------------------
// DOM refs
// ----------------------------------------------------------------
const $ = id => document.getElementById(id)

const elPanelMain     = $('panel-main')
const elPanelSettings = $('panel-settings')
const elSourceInfo    = $('source-info')
const elSourceTitle   = $('source-title')
const elPreview       = $('preview-container')
const elQuestionList  = $('question-list')
const elPreviewCount  = $('preview-count')
const elStatus        = $('status-area')
const elCourseCode    = $('input-course-code')

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadPageMeta()

  // Button wiring
  $('btn-settings').addEventListener('click', openSettings)
  $('btn-cancel-settings').addEventListener('click', closeSettings)
  $('btn-save-config').addEventListener('click', saveConfig)
  $('btn-scan-one').addEventListener('click', scanOne)
  $('btn-scan-all').addEventListener('click', scanAll)
  $('btn-parse-manual').addEventListener('click', parseManual)
  $('btn-clear').addEventListener('click', clearQuestions)
  $('btn-submit').addEventListener('click', submitImport)
})

// ----------------------------------------------------------------
// Page meta — show source title from active tab
// ----------------------------------------------------------------
async function loadPageMeta() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.url?.includes('notebooklm.google.com')) {
    elSourceInfo.classList.remove('hidden')
    elSourceTitle.textContent = tab.title ?? 'NotebookLM'
  }
}

// ----------------------------------------------------------------
// Settings
// ----------------------------------------------------------------
async function openSettings() {
  const config = await sendBackground({ type: 'GET_CONFIG' })
  $('input-api-url').value    = config.apiUrl    ?? ''
  $('input-auth-token').value = config.authToken ?? ''
  elPanelSettings.classList.remove('hidden')
  elPanelMain.classList.add('hidden')
}

function closeSettings() {
  elPanelSettings.classList.add('hidden')
  elPanelMain.classList.remove('hidden')
}

async function saveConfig() {
  const apiUrl    = $('input-api-url').value.trim()
  const authToken = $('input-auth-token').value.trim()

  if (!apiUrl || !authToken) {
    showConfigStatus('Vui lòng điền đầy đủ API URL và Auth Token', 'error')
    return
  }

  const result = await sendBackground({ type: 'SAVE_CONFIG', payload: { apiUrl, authToken } })
  if (result.ok) {
    showConfigStatus('Đã lưu!', 'success')
    setTimeout(closeSettings, 800)
  } else {
    showConfigStatus('Lỗi lưu cấu hình', 'error')
  }
}

function showConfigStatus(msg, type) {
  $('config-status').innerHTML = `<p class="status-msg status-${type}">${msg}</p>`
}

// ----------------------------------------------------------------
// Scan — ask content script to parse DOM
// ----------------------------------------------------------------
async function scanOne() {
  setStatus('Đang scan câu hỏi...', 'loading')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.url?.includes('notebooklm.google.com')) {
    setStatus('❌ Extension chỉ hoạt động trên notebooklm.google.com', 'error')
    return
  }

  let result
  try {
    ;[result] = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_QUESTION' })
      .then(r => [r])
      .catch(() => [null])
  } catch {
    result = null
  }

  if (!result) {
    setStatus('❌ Không nhận được phản hồi từ trang. Hãy reload trang và thử lại.', 'error')
    return
  }

  if (!result.ok) {
    setStatus(`❌ ${result.error}`, 'error')
    return
  }

  addQuestion({ sequence: questions.length + 1, ...result })
  clearStatus()
}

async function scanAll() {
  setStatus('Đang scan tất cả câu hỏi...', 'loading')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  if (!tab?.url?.includes('notebooklm.google.com')) {
    setStatus('❌ Extension chỉ hoạt động trên notebooklm.google.com', 'error')
    return
  }

  let result
  try {
    result = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ALL_QUESTIONS' })
  } catch {
    result = null
  }

  if (!result?.ok) {
    setStatus(`❌ ${result?.error ?? 'Không kết nối được content script'}`, 'error')
    return
  }

  questions = []
  result.questions.forEach((q, i) => addQuestion({ sequence: i + 1, ...q }))
  clearStatus()
}

// ----------------------------------------------------------------
// Manual paste parser
// ----------------------------------------------------------------
function parseManual() {
  const text = $('input-manual-text').value.trim()
  if (!text) {
    setStatus('❌ Vui lòng paste nội dung quiz vào ô text', 'error')
    return
  }

  const parsed = parseManualText(text)
  if (parsed.length === 0) {
    setStatus('❌ Không parse được câu hỏi nào. Kiểm tra lại format.', 'error')
    return
  }

  questions = []
  parsed.forEach((q, i) => addQuestion({ sequence: i + 1, ...q }))
  clearStatus()
}

function parseManualText(text) {
  // Split on blank lines or numbered question patterns
  const blocks = text.split(/\n\s*\n/).filter(b => b.trim())
  const results = []

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 3) continue

    // Find first option line
    const firstOptIdx = lines.findIndex(l => /^[A-Da-d][.)]\s/.test(l))
    if (firstOptIdx === -1) continue

    const stem = lines.slice(0, firstOptIdx).join(' ').replace(/^\d+\.\s*/, '').trim()
    const options = []
    let correctOptionKey = null
    let explanation = null

    for (let i = firstOptIdx; i < lines.length; i++) {
      const optMatch = lines[i].match(/^([A-Da-d])[.)]\s+(.+)/)
      if (optMatch) {
        options.push({ key: optMatch[1].toUpperCase(), text: optMatch[2].trim() })
        continue
      }
      // Correct answer line: "Đáp án: B" or "Answer: B"
      const ansMatch = lines[i].match(/^(?:đáp án|answer|correct)[:\s]+([A-Da-d])/i)
      if (ansMatch) { correctOptionKey = ansMatch[1].toUpperCase(); continue }

      // Explanation line
      const expMatch = lines[i].match(/^(?:giải thích|explanation)[:\s]+(.+)/i)
      if (expMatch) { explanation = expMatch[1].trim(); continue }
    }

    if (!stem || options.length < 2) continue

    const questionType = options.length === 2 &&
      options.every(o => /^(đúng|sai|true|false)$/i.test(o.text))
      ? 'true_false' : 'single_choice'

    results.push({
      ok: true,
      stem,
      questionType,
      options,
      correctOptionKey,
      explanation,
      confidence: correctOptionKey ? 'high' : 'low',
      warnings: correctOptionKey ? [] : ['Chưa xác định được đáp án đúng'],
    })
  }

  return results
}

// ----------------------------------------------------------------
// Question list management
// ----------------------------------------------------------------
function addQuestion(q) {
  questions.push(q)
  renderQuestionList()
}

function removeQuestion(idx) {
  questions.splice(idx, 1)
  // Re-sequence
  questions = questions.map((q, i) => ({ ...q, sequence: i + 1 }))
  renderQuestionList()
}

function clearQuestions() {
  questions = []
  renderQuestionList()
}

function renderQuestionList() {
  if (questions.length === 0) {
    elPreview.classList.add('hidden')
    elQuestionList.innerHTML = ''
    return
  }

  elPreview.classList.remove('hidden')
  elPreviewCount.textContent = `${questions.length} câu hỏi`
  elQuestionList.innerHTML = questions.map((q, i) => renderQuestionCard(q, i)).join('')

  // Wire up correct-answer selects and remove buttons
  questions.forEach((q, i) => {
    const sel = document.querySelector(`.q-correct-select[data-idx="${i}"]`)
    if (sel) {
      sel.addEventListener('change', e => {
        questions[i].correctOptionKey = e.target.value || null
        renderQuestionList()
      })
    }
    const btn = document.querySelector(`.btn-remove[data-idx="${i}"]`)
    if (btn) btn.addEventListener('click', () => removeQuestion(i))
  })
}

function renderQuestionCard(q, i) {
  const hasWarning = (q.warnings ?? []).length > 0
  const hasError   = !q.ok

  const cardClass = hasError ? 'has-error' : hasWarning ? 'has-warning' : ''

  const optionsHtml = (q.options ?? []).map(o => {
    const isCorrect = o.key === q.correctOptionKey
    return `
      <div class="q-option ${isCorrect ? 'correct' : ''}">
        <span class="key">${o.key}</span>
        <span class="opt-text">${escHtml(o.text)}</span>
      </div>`
  }).join('')

  const correctSelectHtml = `
    <div class="q-correct-row">
      <label>Đáp án đúng:</label>
      <select class="q-correct-select" data-idx="${i}">
        <option value="">— chọn —</option>
        ${(q.options ?? []).map(o =>
          `<option value="${o.key}" ${o.key === q.correctOptionKey ? 'selected' : ''}>${o.key}</option>`
        ).join('')}
      </select>
    </div>`

  const warningsHtml = (q.warnings ?? []).map(w =>
    `<div class="q-warning">⚠️ ${escHtml(w)}</div>`
  ).join('')

  const errorHtml = !q.ok ? `<div class="q-error">❌ ${escHtml(q.error ?? 'Lỗi parse')}</div>` : ''

  return `
    <div class="question-card ${cardClass}">
      <button class="btn-remove" data-idx="${i}" title="Xoá câu này">×</button>
      <div class="q-number">Câu ${i + 1} · ${q.questionType ?? 'single_choice'}</div>
      <div class="q-stem">${escHtml(q.stem ?? '')}</div>
      <div class="q-options">${optionsHtml}</div>
      ${correctSelectHtml}
      ${warningsHtml}
      ${errorHtml}
    </div>`
}

// ----------------------------------------------------------------
// Submit import
// ----------------------------------------------------------------
async function submitImport() {
  const courseCode = elCourseCode.value.trim()
  if (!courseCode) {
    setStatus('❌ Vui lòng nhập Course Code', 'error')
    return
  }

  const validQuestions = questions.filter(q => q.ok !== false)
  if (validQuestions.length === 0) {
    setStatus('❌ Không có câu hỏi hợp lệ để import', 'error')
    return
  }

  const missingAnswer = validQuestions.filter(q => !q.correctOptionKey)
  if (missingAnswer.length > 0) {
    setStatus(`❌ ${missingAnswer.length} câu chưa có đáp án đúng. Vui lòng chọn đáp án trước khi import.`, 'error')
    return
  }

  setStatus('⏳ Đang import...', 'loading')
  $('btn-submit').disabled = true

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

  const payload = {
    sourcePlatform: 'notebooklm',
    sourceUrl:      tab?.url ?? '',
    sourceTitle:    tab?.title ?? 'NotebookLM',
    courseCode,
    questions: validQuestions.map((q, i) => ({
      sequence:        i + 1,
      stem:            q.stem,
      questionType:    q.questionType ?? 'single_choice',
      options:         q.options.map(o => ({ key: o.key, text: o.text })),
      correctOptionKeys: [q.correctOptionKey],
      explanation:     q.explanation ?? null,
    })),
  }

  const result = await sendBackground({ type: 'SUBMIT_IMPORT', payload })
  $('btn-submit').disabled = false

  if (result.ok) {
    const d = result.data
    setStatus(
      `✅ Import thành công! Job ID: <strong>${d.importJobId}</strong><br>` +
      `${d.questionsReceived} câu hỏi đã được gửi vào hàng đợi review.`,
      'success'
    )
    clearQuestions()
    elCourseCode.value = ''
  } else {
    setStatus(`❌ Import thất bại: ${result.error}`, 'error')
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------
function sendBackground(message) {
  return chrome.runtime.sendMessage(message)
}

function setStatus(html, type) {
  elStatus.innerHTML = `<div class="status-msg status-${type}">${html}</div>`
}

function clearStatus() {
  elStatus.innerHTML = ''
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

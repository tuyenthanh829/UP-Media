// Content script — runs on notebooklm.google.com
// Scans the DOM for quiz question, options, correct answer indicator, explanation.
// Sends parsed data back to popup via chrome.runtime.sendMessage.

// ----------------------------------------------------------------
// Message listener from popup
// ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SCAN_QUESTION') {
    const result = scanCurrentQuestion()
    sendResponse(result)
  }
  if (message.type === 'SCAN_ALL_QUESTIONS') {
    const results = scanAllVisibleQuestions()
    sendResponse(results)
  }
})

// ----------------------------------------------------------------
// Core scanner: parse a single visible quiz card
// NotebookLM renders quizzes as a card with stem, options, and
// an optional highlighted/checked correct answer after user answers.
// ----------------------------------------------------------------
function scanCurrentQuestion() {
  // Strategy: find the most prominent quiz question container.
  // NotebookLM uses data attributes and ARIA roles on quiz elements.
  // Fall back to text heuristics if structure changes.

  const card = findActiveQuizCard()
  if (!card) {
    return { ok: false, error: 'Không tìm thấy câu hỏi quiz. Hãy mở một câu hỏi trong NotebookLM.' }
  }

  return parseQuizCard(card)
}

function scanAllVisibleQuestions() {
  const cards = findAllQuizCards()
  if (cards.length === 0) {
    return { ok: false, error: 'Không tìm thấy câu hỏi quiz nào trên trang này.' }
  }

  const results = cards.map((card, i) => {
    const parsed = parseQuizCard(card)
    return { sequence: i + 1, ...parsed }
  })

  return { ok: true, count: results.length, questions: results }
}

// ----------------------------------------------------------------
// DOM selectors — these may need to be updated if NotebookLM changes
// Always scan by multiple strategies for resilience
// ----------------------------------------------------------------

function findActiveQuizCard() {
  // Strategy 1: role="group" with quiz-related aria labels
  const groups = document.querySelectorAll('[role="group"], [role="listitem"]')
  for (const g of groups) {
    if (looksLikeQuizCard(g)) return g
  }

  // Strategy 2: common quiz container classes
  const containers = document.querySelectorAll(
    '.quiz-question, .question-card, [data-testid*="quiz"], [data-testid*="question"]'
  )
  if (containers.length > 0) return containers[0]

  // Strategy 3: find element containing a question mark followed by option letters
  return findByHeuristic()
}

function findAllQuizCards() {
  const candidates = []

  // Try structured selectors first
  const structured = document.querySelectorAll(
    '[role="listitem"], .quiz-question, .question-card, [data-testid*="question"]'
  )
  for (const el of structured) {
    if (looksLikeQuizCard(el)) candidates.push(el)
  }

  if (candidates.length > 0) return candidates

  // Fall back: find all heuristic matches
  return findAllByHeuristic()
}

function looksLikeQuizCard(el) {
  const text = el.textContent ?? ''
  // Must have at least 2 option-like lines (A. / B. or 1. / 2.)
  const hasOptions = (text.match(/^[A-D]\.\s/gm) ?? []).length >= 2 ||
                     (text.match(/^[1-4]\.\s/gm) ?? []).length >= 2
  const hasStem = text.trim().length > 20
  return hasOptions && hasStem
}

function findByHeuristic() {
  const allDivs = document.querySelectorAll('div, section, article')
  for (const div of allDivs) {
    if (div.children.length > 2 && looksLikeQuizCard(div)) return div
  }
  return null
}

function findAllByHeuristic() {
  const results = []
  const allDivs = document.querySelectorAll('div, section, article')
  const seen = new Set()
  for (const div of allDivs) {
    if (div.children.length > 2 && looksLikeQuizCard(div) && !seen.has(div.textContent)) {
      results.push(div)
      seen.add(div.textContent)
    }
  }
  return results
}

// ----------------------------------------------------------------
// Parse a quiz card element into structured data
// ----------------------------------------------------------------
function parseQuizCard(card) {
  const text = card.textContent ?? ''
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // --- Extract stem (everything before first option line) ---
  const firstOptionIdx = lines.findIndex(l => /^[A-Da-d1-4][.)]\s/.test(l))
  if (firstOptionIdx === -1) {
    return { ok: false, error: 'Không xác định được câu hỏi và đáp án' }
  }

  const stem = lines.slice(0, firstOptionIdx).join(' ').trim()
  if (!stem) {
    return { ok: false, error: 'Không tìm thấy nội dung câu hỏi' }
  }

  // --- Extract options ---
  const optionLines = []
  for (let i = firstOptionIdx; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Da-d1-4])[.)]\s+(.+)/)
    if (m) optionLines.push({ rawKey: m[1].toUpperCase(), text: m[2].trim() })
  }

  if (optionLines.length < 2) {
    return { ok: false, error: 'Không đủ đáp án (cần ít nhất 2)' }
  }

  // Normalize keys to A/B/C/D
  const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }
  const options = optionLines.slice(0, 4).map(o => ({
    key: keyMap[o.rawKey] ?? o.rawKey,
    text: o.text,
  }))

  // --- Detect question type ---
  const questionType = options.length === 2 &&
    options.every(o => /^(đúng|sai|true|false|có|không)$/i.test(o.text))
    ? 'true_false'
    : 'single_choice'

  // --- Try to detect correct answer ---
  // NotebookLM highlights correct answer visually after submission.
  // Look for aria-selected, aria-checked, or specific class markers.
  let correctOptionKey = detectCorrectAnswer(card, options)

  // --- Try to find explanation ---
  const explanation = detectExplanation(card, lines, firstOptionIdx + optionLines.length)

  return {
    ok: true,
    stem,
    questionType,
    options,
    correctOptionKey,
    explanation,
    confidence: correctOptionKey ? 'high' : 'low',
    warnings: correctOptionKey ? [] : ['Chưa xác định được đáp án đúng — vui lòng chọn thủ công'],
  }
}

// ----------------------------------------------------------------
// Detect correct answer from DOM markers
// ----------------------------------------------------------------
function detectCorrectAnswer(card, options) {
  // Strategy 1: aria-selected or aria-checked on option elements
  const selected = card.querySelector('[aria-selected="true"], [aria-checked="true"]')
  if (selected) {
    const selText = selected.textContent?.trim() ?? ''
    const matched = options.find(o => selText.includes(o.text))
    if (matched) return matched.key
  }

  // Strategy 2: visual "correct" indicator class
  const correctEl = card.querySelector(
    '.correct, .is-correct, [data-correct="true"], [data-state="correct"]'
  )
  if (correctEl) {
    const corrText = correctEl.textContent?.trim() ?? ''
    const matched = options.find(o => corrText.includes(o.text))
    if (matched) return matched.key
  }

  // Strategy 3: checkmark icon next to an option
  const checkmarks = card.querySelectorAll('svg[aria-label*="correct"], svg[aria-label*="check"], .checkmark')
  for (const mark of checkmarks) {
    const parent = mark.closest('li, [role="option"], div')
    if (parent) {
      const parentText = parent.textContent?.trim() ?? ''
      const matched = options.find(o => parentText.includes(o.text))
      if (matched) return matched.key
    }
  }

  return null
}

// ----------------------------------------------------------------
// Detect explanation text (appears after options)
// ----------------------------------------------------------------
function detectExplanation(card, lines, afterIdx) {
  // Look for explicit explanation section
  const explEl = card.querySelector(
    '[data-testid*="explanation"], .explanation, .rationale'
  )
  if (explEl) {
    const text = explEl.textContent?.trim()
    if (text && text.length > 10) return text
  }

  // Fall back to text after options
  const afterLines = lines.slice(afterIdx).filter(l =>
    !(/^[A-D][.)]\s/.test(l)) && l.length > 15
  )
  return afterLines.length > 0 ? afterLines.join(' ').trim() : null
}

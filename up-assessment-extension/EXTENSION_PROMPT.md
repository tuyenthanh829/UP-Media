# Chrome Extension — NotebookLM Quiz Importer

Build a Chrome Extension (Manifest V3) that scrapes quiz questions from
notebooklm.google.com and sends them to a REST API.

---

## Constraints

- Manifest V3 only. No remote code execution. No eval().
- `host_permissions` scoped to `https://notebooklm.google.com/*` only.
- No secrets in the extension. Auth uses a short-lived user JWT stored in
  `chrome.storage.local` (not `sync`). The user pastes it manually.
- All fetch calls go through the background service worker — never from
  the popup or content script directly.
- Extension must work without a build step: plain JS files, load unpacked.

---

## File structure

```
extension/
  manifest.json
  src/
    background/background.js   ← service worker, all fetch calls
    content/content.js         ← DOM scraper, runs on notebooklm.google.com
    popup/
      popup.html
      popup.css
      popup.js
  icons/
    icon16.png  icon48.png  icon128.png   ← placeholder PNGs are fine
```

---

## What to scrape from NotebookLM

NotebookLM renders quizzes as cards. Each card contains:

1. **Stem** — the question text (before first option line)
2. **Options** — labelled A. / B. / C. / D.  or  1. / 2. / 3. / 4.
3. **Correct answer** — highlighted visually after the user answers.
   Detect via (try all, use first that works):
   - `[aria-selected="true"]` or `[aria-checked="true"]` on an option element
   - `.correct`, `.is-correct`, `[data-correct="true"]`, `[data-state="correct"]`
   - `<svg aria-label*="correct">` or `<svg aria-label*="check">` adjacent to an option
4. **Explanation** — text that appears below the options after answering.
   Detect via `[data-testid*="explanation"]`, `.explanation`, `.rationale`,
   or plain text after the last option line.

**Question type detection:**
- If exactly 2 options and both match `/^(đúng|sai|true|false|có|không)$/i` → `"true_false"`
- Otherwise → `"single_choice"`

**Option key normalisation:**
- A/B/C/D → keep as-is
- 1/2/3/4 → map to A/B/C/D

**Resilience strategy (try in order):**
1. `[role="group"]` or `[role="listitem"]` that contains ≥2 option lines
2. `.quiz-question`, `.question-card`, `[data-testid*="quiz"]`, `[data-testid*="question"]`
3. Any `<div>` / `<section>` / `<article>` with ≥3 children whose text contains
   ≥2 lines matching `/^[A-D]\.\s/m`

If correct answer cannot be detected, return `correctOptionKey: null` and add
a warning: `"Chưa xác định được đáp án đúng — vui lòng chọn thủ công"`.

---

## API contract

### Endpoint
```
POST <API_URL>/api/imports/notebooklm
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

### Request payload
```json
{
  "sourcePlatform": "notebooklm",
  "sourceUrl":      "https://notebooklm.google.com/...",
  "sourceTitle":    "Page title from chrome.tabs",
  "parserVersion":  "1.0.0",
  "courseCode":     "ACCOUNT-BASIC",
  "questions": [
    {
      "sequence":          1,
      "stem":              "Bút toán nào ghi nhận tiền mặt nhận được?",
      "questionType":      "single_choice",
      "options": [
        { "key": "A", "text": "Nợ Tiền mặt / Có Doanh thu" },
        { "key": "B", "text": "Nợ Doanh thu / Có Tiền mặt" }
      ],
      "correctOptionKeys": ["A"],
      "explanation":       "Tiền mặt tăng → ghi Nợ bên Tài sản."
    }
  ]
}
```

Rules:
- `questions`: 1–100 items
- `stem`: min 5 chars
- `options`: 2–4 items
- `correctOptionKeys`: array with exactly 1 item (MVP: single choice only)
- `explanation`: optional, can be null

### Success response
```json
{
  "importJobId":       "uuid",
  "questionsReceived": 5,
  "status":            "imported"
}
```

### Error responses
- `401` — token missing or expired → show "Phiên đăng nhập hết hạn, lấy lại token"
- `400` — payload validation failed → show `details` field
- `500` — server error

---

## Popup UI — required elements and behaviour

### Settings panel (hidden by default, toggle via ⚙ button)
- Input: `API URL` — e.g. `https://your-domain.com` (no trailing slash)
- Input: `Auth Token` — user pastes their JWT here
  - Add a help text: "Lấy token tại: <API_URL>/api/auth/token sau khi đăng nhập"
- Button: Save → `chrome.storage.local.set({ apiUrl, authToken })`
- Both fields required; show inline error if empty

### Main panel
- Source info bar: show active tab title when on notebooklm.google.com
- **Scan one** button → send `SCAN_QUESTION` to content script → add result to list
- **Scan all** button → send `SCAN_ALL_QUESTIONS` to content script → replace list
- **Manual paste** mode:
  - Textarea for pasting copied quiz text
  - Parse button → run local parser on textarea content
  - Accepted format per question block (blank line between questions):
    ```
    1. Câu hỏi ở đây?
    A. Đáp án A
    B. Đáp án B
    Đáp án: A
    Giải thích: Lý do...
    ```
  - Also accept "Answer: A" (English)
- **Course Code** input (required before submit, e.g. `ACCOUNT-BASIC`)
- **Question preview list**: for each question show:
  - Sequence number + question type badge
  - Stem text
  - Options — highlight the correct one in green
  - Dropdown to override correct answer (show all options A/B/C/D)
  - Warning badge if `correctOptionKey` is null
  - × button to remove this question from the list
- **Submit** button:
  - Disabled until ≥1 valid question with correctOptionKey set AND courseCode filled
  - Shows count: "Import 5 câu hỏi"
  - On success: clear list, show Job ID
  - On 401: prompt user to refresh token
- **Status area**: loading / success / error messages with distinct styling

### UI rules
- Popup width: 420px. Height: auto, max 600px with scroll.
- Use system font stack, no external font loads.
- No external CSS framework. Plain CSS only.
- Vietnamese labels, English for technical terms (Course Code, Import, etc.)

---

## Background service worker

Messages handled (all from popup):

| type | payload | action |
|---|---|---|
| `GET_CONFIG` | — | Return `{ apiUrl, authToken }` from storage |
| `SAVE_CONFIG` | `{ apiUrl, authToken }` | Save to storage, return `{ ok: true }` |
| `SUBMIT_IMPORT` | import payload (without parserVersion) | Inject `parserVersion`, POST to API, return `{ ok, data/error }` |

Fetch logic in background:
1. Read `apiUrl` and `authToken` from `chrome.storage.local`
2. If either missing → return `{ ok: false, error: 'Chưa cấu hình' }`
3. POST to `${apiUrl}/api/imports/notebooklm`
4. On network error → return `{ ok: false, error: 'Lỗi kết nối: ...' }`
5. On HTTP error → parse body, return `{ ok: false, error: data.error ?? 'HTTP NNN' }`
6. On success → return `{ ok: true, data }`

---

## Content script

Exported message handlers:

| message type | returns |
|---|---|
| `SCAN_QUESTION` | Single parsed question object OR `{ ok: false, error: '...' }` |
| `SCAN_ALL_QUESTIONS` | `{ ok: true, count: N, questions: [...] }` OR `{ ok: false, error }` |

Parsed question object shape:
```js
{
  ok:              true,
  stem:            "...",
  questionType:    "single_choice" | "true_false",
  options:         [{ key: "A", text: "..." }, ...],
  correctOptionKey: "A" | null,
  explanation:     "..." | null,
  confidence:      "high" | "low",
  warnings:        ["..."] | [],
}
```

Do NOT background-scan the page automatically. Only scan on explicit user action.

---

## What NOT to do

- Do not store `SUPABASE_SERVICE_ROLE_KEY` or any server secret in the extension.
- Do not use `chrome.storage.sync` for the auth token (token is per-device).
- Do not inject scripts dynamically at runtime (MV3 restriction).
- Do not load any external resources (fonts, CDN scripts, analytics).
- Do not auto-submit on scan. User must preview and confirm.
- Do not send `is_correct` field in options to the API (server does not accept it).

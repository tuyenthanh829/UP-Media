// Background service worker — MV3
// Handles: auth token storage, import API calls, message routing

const PARSER_VERSION = '1.0.0'

// ----------------------------------------------------------------
// Message router from popup / content script
// ----------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_CONFIG':
      handleGetConfig().then(sendResponse)
      return true

    case 'SAVE_CONFIG':
      handleSaveConfig(message.payload).then(sendResponse)
      return true

    case 'SUBMIT_IMPORT':
      handleSubmitImport(message.payload).then(sendResponse)
      return true

    case 'GET_IMPORT_STATUS':
      handleGetImportStatus(message.jobId).then(sendResponse)
      return true

    default:
      sendResponse({ ok: false, error: 'Unknown message type' })
  }
})

// ----------------------------------------------------------------
// Config: store API URL + auth token in chrome.storage.local
// NEVER store service_role key here — only user session token
// ----------------------------------------------------------------
async function handleGetConfig() {
  const config = await chrome.storage.local.get(['apiUrl', 'authToken'])
  return {
    apiUrl:    config.apiUrl    ?? '',
    authToken: config.authToken ?? '',
  }
}

async function handleSaveConfig({ apiUrl, authToken }) {
  await chrome.storage.local.set({ apiUrl, authToken })
  return { ok: true }
}

// ----------------------------------------------------------------
// Submit import payload to UP Assessment API
// ----------------------------------------------------------------
async function handleSubmitImport(payload) {
  const { apiUrl, authToken } = await chrome.storage.local.get(['apiUrl', 'authToken'])

  if (!apiUrl || !authToken) {
    return { ok: false, error: 'Chưa cấu hình API URL hoặc chưa đăng nhập' }
  }

  // Inject parser version
  const importPayload = {
    ...payload,
    parserVersion: PARSER_VERSION,
  }

  try {
    const res = await fetch(`${apiUrl}/api/imports/notebooklm`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(importPayload),
    })

    const data = await res.json()

    if (!res.ok) {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` }
    }

    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: `Lỗi kết nối: ${err.message}` }
  }
}

// ----------------------------------------------------------------
// Check import job status
// ----------------------------------------------------------------
async function handleGetImportStatus(jobId) {
  const { apiUrl, authToken } = await chrome.storage.local.get(['apiUrl', 'authToken'])

  if (!apiUrl || !authToken) {
    return { ok: false, error: 'Chưa cấu hình' }
  }

  try {
    const res = await fetch(`${apiUrl}/api/imports/${jobId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    })
    const data = await res.json()
    return res.ok ? { ok: true, data } : { ok: false, error: data.error }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

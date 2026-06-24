const MAX_QUESTIONS = 300;
const ALPHA_KEYS = ["A", "B", "C", "D"];
const SHEET_COLUMNS = [
  "STT",
  "Câu hỏi",
  "Phương án A",
  "Phương án B",
  "Phương án C",
  "Phương án D",
  "Đáp án đúng",
  "Giải thích A",
  "Giải thích B",
  "Giải thích C",
  "Giải thích D",
  "Gợi ý"
];

const state = {
  activeTab: null,
  questions: [],
  isBusy: false
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  await loadActiveTab();
  render();
}

function cacheElements() {
  elements.sourceInfo = document.getElementById("sourceInfo");
  elements.scanVisibleButton = document.getElementById("scanVisibleButton");
  elements.scanAllButton = document.getElementById("scanAllButton");
  elements.manualTextInput = document.getElementById("manualTextInput");
  elements.parseManualButton = document.getElementById("parseManualButton");
  elements.downloadCsvButton = document.getElementById("downloadCsvButton");
  elements.copyTsvButton = document.getElementById("copyTsvButton");
  elements.openSheetsButton = document.getElementById("openSheetsButton");
  elements.questionCount = document.getElementById("questionCount");
  elements.questionList = document.getElementById("questionList");
  elements.statusArea = document.getElementById("statusArea");
}

function bindEvents() {
  elements.scanVisibleButton.addEventListener("click", scanVisibleQuestion);
  elements.scanAllButton.addEventListener("click", scanAllQuestions);
  elements.parseManualButton.addEventListener("click", parseManualText);
  elements.downloadCsvButton.addEventListener("click", downloadCsv);
  elements.copyTsvButton.addEventListener("click", copyTsv);
  elements.openSheetsButton.addEventListener("click", openGoogleSheets);
}

async function loadActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  state.activeTab = tabs[0] || null;
}

async function scanVisibleQuestion() {
  if (!ensureNotebookTab()) {
    return;
  }

  setBusy(true);
  setStatus("loading", "Dang scan cau hoi dang hien thi...");
  const response = await safeSendTabMessage({ type: "SCAN_VISIBLE_QUESTION" });
  setBusy(false);

  if (!response || response.ok === false) {
    setStatus("error", (response && response.error) || "Khong scan duoc cau hoi.");
    return;
  }

  upsertQuestions([normalizeQuestion(response.question)]);
  setStatus("success", "Da them cau hoi dang hien thi.");
  render();
}

async function scanAllQuestions() {
  if (!ensureNotebookTab()) {
    return;
  }

  setBusy(true);
  setStatus("loading", "Dang auto scan. Khong thao tac tren tab NotebookLM cho den khi xong...");
  const response = await safeSendTabMessage({ type: "SCAN_ALL_QUESTIONS" });
  setBusy(false);

  if (!response || response.ok === false) {
    setStatus("error", (response && response.error) || "Khong scan duoc danh sach cau hoi.");
    return;
  }

  state.questions = response.questions.map(normalizeQuestion).slice(0, MAX_QUESTIONS);
  const totalText = response.totalHint ? `/${response.totalHint}` : "";
  const noteText = response.scanNotes && response.scanNotes.length ? ` ${response.scanNotes.join(" ")}` : "";
  setStatus("success", `Da scan ${state.questions.length}${totalText} cau hoi.${noteText}`);
  render();
}

function parseManualText() {
  const text = elements.manualTextInput.value.trim();
  if (!text) {
    setStatus("error", "Dan noi dung cau hoi truoc khi parse.");
    return;
  }

  const questions = parseQuestionsFromText(text);
  if (!questions.length) {
    setStatus("error", "Khong doc duoc cau hoi tu noi dung da dan.");
    return;
  }

  state.questions = questions.slice(0, MAX_QUESTIONS);
  setStatus("success", `Da parse ${state.questions.length} cau hoi.`);
  render();
}

function downloadCsv() {
  const rows = buildSheetRows();
  const csv = rowsToDelimitedText(rows, ",");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = makeExportFileName("csv");
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("success", `Da tai ${state.questions.length} cau hoi thanh CSV.`);
}

async function copyTsv() {
  try {
    await copyCurrentTsv();
    setStatus("success", "Da copy TSV. Dan truc tiep vao Google Sheets/Excel.");
  } catch (_error) {
    setStatus("error", "Chrome khong cho copy clipboard. Hay dung Download CSV.");
  }
}

async function openGoogleSheets() {
  try {
    await copyCurrentTsv();
    await chrome.tabs.create({ url: "https://sheet.new" });
    setStatus("success", "Da copy TSV va mo Google Sheets moi. Chon o A1 roi dan vao.");
  } catch (_error) {
    setStatus("error", "Khong copy/mo Google Sheets duoc. Hay dung Copy TSV.");
  }
}

async function copyCurrentTsv() {
  const rows = buildSheetRows();
  const tsv = rows.map((row) => row.join("\t")).join("\n");
  await navigator.clipboard.writeText(tsv);
}

function buildSheetRows() {
  const rows = [SHEET_COLUMNS];

  state.questions.forEach((question, index) => {
    const options = question.options || [];

    rows.push([
      index + 1,
      question.question,
      options[0] ? options[0].text : "",
      options[1] ? options[1].text : "",
      options[2] ? options[2].text : "",
      options[3] ? options[3].text : "",
      question.correctAnswer || "",
      options[0] ? options[0].rationale : "",
      options[1] ? options[1].rationale : "",
      options[2] ? options[2].rationale : "",
      options[3] ? options[3].rationale : "",
      question.hint || ""
    ]);
  });

  return rows;
}

function rowsToDelimitedText(rows, delimiter) {
  return rows
    .map((row) =>
      row
        .map((cell) => escapeDelimitedCell(cell, delimiter))
        .join(delimiter)
    )
    .join("\r\n");
}

function escapeDelimitedCell(value, delimiter) {
  const text = String(value ?? "");
  const mustQuote =
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r") ||
    text.includes(delimiter);

  if (!mustQuote) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function makeExportFileName(extension) {
  const title = state.activeTab && state.activeTab.title ? state.activeTab.title : "notebooklm";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const date = new Date().toISOString().slice(0, 10);
  return `${slug || "notebooklm"}-questions-${date}.${extension}`;
}

function parseQuestionsFromText(text) {
  return text
    .split(/\n\s*\n+/)
    .map((block) => parseQuestionBlock(block))
    .filter(Boolean);
}

function parseQuestionBlock(block) {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const options = [];
  const stemLines = [];
  let correctOptionKey = null;
  let explanation = "";

  for (const line of lines) {
    const option = parseOptionLine(line);
    if (option) {
      options.push(option);
      continue;
    }

    const answer = line.match(/^(đáp án|dap an|answer)\s*[:：-]\s*([A-Da-d1-4])\s*$/i);
    if (answer) {
      correctOptionKey = normalizeOptionKey(answer[2]);
      continue;
    }

    const explanationMatch = line.match(
      /^(giải thích|giai thich|explanation|rationale)\s*[:：-]\s*(.+)$/i
    );
    if (explanationMatch) {
      explanation = explanationMatch[2].trim();
      continue;
    }

    if (!options.length) {
      stemLines.push(line);
    } else {
      explanation = explanation ? `${explanation} ${line}` : line;
    }
  }

  const stem = cleanStem(stemLines.join(" "));
  if (stem.length < 5 || options.length < 2 || options.length > 4) {
    return null;
  }

  const normalizedOptions = options.map((option) => ({
    key: normalizeOptionKey(option.rawKey),
    text: option.text
  }));

  if (!normalizedOptions.some((option) => option.key === correctOptionKey)) {
    correctOptionKey = null;
  }

  return normalizeQuestion({
    stem,
    questionType: detectQuestionType(normalizedOptions),
    options: normalizedOptions,
    correctOptionKey,
    explanation,
    progress: "",
    confidence: correctOptionKey ? "high" : "low",
    warnings: correctOptionKey ? [] : ["Chua xac dinh duoc dap an dung."]
  });
}

function parseOptionLine(line) {
  const match = line.match(/^\s*([A-Da-d]|[1-4])[\.)]\s+(.+)$/);
  if (!match) {
    return null;
  }

  return {
    rawKey: match[1],
    text: match[2].trim()
  };
}

function upsertQuestions(questions) {
  const existing = new Set(state.questions.map(makeQuestionFingerprint));

  for (const question of questions) {
    const fingerprint = makeQuestionFingerprint(question);
    if (existing.has(fingerprint)) {
      continue;
    }

    existing.add(fingerprint);
    state.questions.push(question);
  }

  state.questions = state.questions.slice(0, MAX_QUESTIONS);
}

function render() {
  renderSourceInfo();
  renderQuestions();
  renderExportState();
}

function renderSourceInfo() {
  if (!state.activeTab) {
    elements.sourceInfo.textContent = "Khong doc duoc tab hien tai.";
    return;
  }

  if (!isNotebookUrl(state.activeTab.url)) {
    elements.sourceInfo.textContent = "Mo notebooklm.google.com de scan cau hoi.";
    return;
  }

  elements.sourceInfo.textContent = state.activeTab.title || "notebooklm.google.com";
}

function renderQuestions() {
  elements.questionCount.textContent = `${state.questions.length} cau hoi`;
  elements.questionList.replaceChildren();

  if (!state.questions.length) {
    const empty = document.createElement("p");
    empty.className = "source-info";
    empty.textContent = "Chua co cau hoi nao trong danh sach.";
    elements.questionList.append(empty);
    return;
  }

  state.questions.forEach((question, index) => {
    elements.questionList.append(createQuestionCard(question, index));
  });
}

function createQuestionCard(question, index) {
  const card = document.createElement("article");
  card.className = "question-card";

  const topLine = document.createElement("div");
  topLine.className = "question-topline";

  const meta = document.createElement("div");
  meta.className = "question-meta";

  const sequence = document.createElement("span");
  sequence.className = "sequence";
  sequence.textContent = `#${index + 1}`;

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = question.correctAnswer ? `Dap an ${question.correctAnswer}` : "Chua ro";

  meta.append(sequence, badge);

  const removeButton = document.createElement("button");
  removeButton.className = "remove-button";
  removeButton.type = "button";
  removeButton.title = "Xoa cau hoi";
  removeButton.setAttribute("aria-label", "Xoa cau hoi");
  removeButton.textContent = "x";
  removeButton.addEventListener("click", () => {
    state.questions.splice(index, 1);
    render();
  });

  topLine.append(meta, removeButton);

  const stem = document.createElement("p");
  stem.className = "stem";
  stem.textContent = question.question;

  const optionList = document.createElement("div");
  optionList.className = "option-list";

  question.options.forEach((option, optionIndex) => {
    const optionKey = ALPHA_KEYS[optionIndex];
    const row = document.createElement("div");
    row.className = optionKey === question.correctAnswer ? "option-row correct" : "option-row";

    const key = document.createElement("span");
    key.className = "option-key";
    key.textContent = optionKey;

    const text = document.createElement("span");
    text.textContent = option.text;

    row.append(key, text);
    optionList.append(row);
  });

  const overrideRow = document.createElement("div");
  overrideRow.className = "override-row";

  const overrideLabel = document.createElement("label");
  overrideLabel.textContent = "Dap an";
  overrideLabel.setAttribute("for", `correct-${index}`);

  const select = document.createElement("select");
  select.id = `correct-${index}`;

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Chua ro";
  select.append(emptyOption);

  question.options.forEach((_option, optionIndex) => {
    const optionKey = ALPHA_KEYS[optionIndex];
    const optionNode = document.createElement("option");
    optionNode.value = optionKey;
    optionNode.textContent = optionKey;
    select.append(optionNode);
  });

  select.value = question.correctAnswer || "";
  select.addEventListener("change", () => {
    question.correctAnswer = select.value || "";
    question.warnings = question.correctAnswer ? [] : ["Chua xac dinh duoc dap an dung."];
    render();
  });

  overrideRow.append(overrideLabel, select);
  card.append(topLine, stem, optionList, overrideRow);

  if (question.warnings && question.warnings.length) {
    const warnings = document.createElement("div");
    warnings.className = "warning-list";
    question.warnings.forEach((warning) => {
      const warningBadge = document.createElement("span");
      warningBadge.className = "warning-badge";
      warningBadge.textContent = warning;
      warnings.append(warningBadge);
    });
    card.append(warnings);
  }

  return card;
}

function renderExportState() {
  const hasQuestions = state.questions.length > 0;
  const disabled = !hasQuestions || state.isBusy;
  elements.downloadCsvButton.disabled = disabled;
  elements.copyTsvButton.disabled = disabled;
  elements.openSheetsButton.disabled = disabled;
}

function normalizeQuestion(question) {
  const correctAnswer = question.correctAnswer
    ? normalizeOptionKey(question.correctAnswer)
    : question.correctOptionKey
      ? normalizeOptionKey(question.correctOptionKey)
      : "";

  const sourceOptions = question.options || question.answerOptions || [];
  const options = sourceOptions.slice(0, 4).map((option, index) => {
    const optionKey = option.key ? normalizeOptionKey(option.key) : ALPHA_KEYS[index];

    return {
      text: String(option.text || "").trim(),
      rationale: String(option.rationale || "").trim(),
      isCorrect: Boolean(option.isCorrect) || optionKey === correctAnswer
    };
  });

  return {
    question: String(question.question || question.stem || "").trim(),
    options,
    correctAnswer,
    hint: String(question.hint || "").trim(),
    warnings: correctAnswer ? [] : question.warnings || ["Chua xac dinh duoc dap an dung."]
  };
}

function detectQuestionType(options) {
  if (
    options.length === 2 &&
    options.every((option) =>
      /^(đúng|sai|dung|true|false|co|có|khong|không)$/i.test(normalizeAnswerText(option.text))
    )
  ) {
    return "true_false";
  }

  return "single_choice";
}

function normalizeOptionKey(rawKey) {
  const value = String(rawKey || "").trim().toUpperCase();
  if (/^[A-D]$/.test(value)) {
    return value;
  }

  const numericIndex = Number(value) - 1;
  return ALPHA_KEYS[numericIndex] || value;
}

function normalizeAnswerText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[.!?。]+$/g, "");
}

function cleanStem(text) {
  return String(text || "")
    .replace(/^\s*\d+[\.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureNotebookTab() {
  if (!state.activeTab || !isNotebookUrl(state.activeTab.url)) {
    setStatus("error", "Mo tab notebooklm.google.com truoc khi scan.");
    return false;
  }

  return true;
}

function isNotebookUrl(url) {
  try {
    return new URL(url).hostname === "notebooklm.google.com";
  } catch (_error) {
    return false;
  }
}

async function safeSendTabMessage(message) {
  try {
    return await chrome.tabs.sendMessage(state.activeTab.id, message, { frameId: 0 });
  } catch (_error) {
    return {
      ok: false,
      error: "Khong ket noi duoc content script. Reload tab NotebookLM roi thu lai."
    };
  }
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  elements.scanVisibleButton.disabled = isBusy;
  elements.scanAllButton.disabled = isBusy;
  elements.parseManualButton.disabled = isBusy;
  renderExportState();
}

function setStatus(type, message) {
  elements.statusArea.className = `status-area status-${type}`;
  elements.statusArea.textContent = message;
}

function makeQuestionFingerprint(question) {
  return `${question.question}::${question.options
    .map((option, index) => `${ALPHA_KEYS[index]}:${option.text}`)
    .join("|")}`;
}

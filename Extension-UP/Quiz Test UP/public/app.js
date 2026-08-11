const state = {
  quizzes: [],
  results: [],
  activeQuiz: null,
  answers: {},
  timerId: null,
  endsAt: 0
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  cacheElements();
  bindEvents();
  await refreshData();
  routeFromUrl();
}

function cacheElements() {
  elements.tabButtons = document.querySelectorAll(".tab-button");
  elements.views = {
    admin: document.getElementById("adminView"),
    test: document.getElementById("testView"),
    results: document.getElementById("resultsView")
  };
  elements.quizForm = document.getElementById("quizForm");
  elements.quizTitleInput = document.getElementById("quizTitleInput");
  elements.durationInput = document.getElementById("durationInput");
  elements.tsvInput = document.getElementById("tsvInput");
  elements.quizCount = document.getElementById("quizCount");
  elements.quizList = document.getElementById("quizList");
  elements.quizSelect = document.getElementById("quizSelect");
  elements.selectedQuizInfo = document.getElementById("selectedQuizInfo");
  elements.participantNameInput = document.getElementById("participantNameInput");
  elements.participantCodeInput = document.getElementById("participantCodeInput");
  elements.startTestButton = document.getElementById("startTestButton");
  elements.startPanel = document.getElementById("startPanel");
  elements.testPanel = document.getElementById("testPanel");
  elements.scorePanel = document.getElementById("scorePanel");
  elements.runningQuizTitle = document.getElementById("runningQuizTitle");
  elements.answerProgress = document.getElementById("answerProgress");
  elements.timerBox = document.getElementById("timerBox");
  elements.answerForm = document.getElementById("answerForm");
  elements.submitTestButton = document.getElementById("submitTestButton");
  elements.resultsList = document.getElementById("resultsList");
  elements.downloadResultsCsvLink = document.getElementById("downloadResultsCsvLink");
  elements.downloadResultsExcelLink = document.getElementById("downloadResultsExcelLink");
  elements.statusArea = document.getElementById("statusArea");
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  elements.quizForm.addEventListener("submit", createQuiz);
  elements.quizSelect.addEventListener("change", updateSelectedQuizInfo);
  elements.startTestButton.addEventListener("click", startTest);
  elements.submitTestButton.addEventListener("click", () => submitTest(false));
  window.addEventListener("hashchange", routeFromUrl);
}

async function refreshData() {
  const [quizResponse, resultResponse] = await Promise.all([
    apiGet("/api/quizzes"),
    apiGet("/api/results")
  ]);

  state.quizzes = quizResponse.quizzes || [];
  state.results = resultResponse.results || [];
  renderQuizList();
  renderQuizSelect();
  renderResults();
}

async function createQuiz(event) {
  event.preventDefault();
  const title = elements.quizTitleInput.value.trim();
  const durationMinutes = Number(elements.durationInput.value);
  const tsv = elements.tsvInput.value.trim();

  if (!title || !tsv) {
    setStatus("Nhap ten bai test va TSV truoc.");
    return;
  }

  try {
    const response = await apiPost("/api/quizzes", { title, durationMinutes, tsv });
    elements.tsvInput.value = "";
    elements.quizTitleInput.value = "";
    setStatus(`Da tao "${response.quiz.title}" voi ${response.quiz.questionCount} cau.`);
    await refreshData();
    prepareStartPanel(response.quiz.id);
    showView("test");
  } catch (error) {
    setStatus(error.message);
  }
}

async function startTest() {
  const quizId = elements.quizSelect.value;
  const participantName = elements.participantNameInput.value.trim();

  if (!quizId) {
    setStatus("Chon bai test truoc.");
    return;
  }

  if (!participantName) {
    setStatus("Nhap ho ten nguoi lam bai.");
    elements.participantNameInput.focus();
    return;
  }

  try {
    const response = await apiGet(`/api/quizzes/${encodeURIComponent(quizId)}`);
    state.activeQuiz = response.quiz;
    state.answers = {};
    renderTest();
    elements.startPanel.classList.add("hidden");
    elements.scorePanel.classList.add("hidden");
    elements.testPanel.classList.remove("hidden");
    showView("test");
    startTimer(state.activeQuiz.durationMinutes);
  } catch (error) {
    setStatus(error.message);
  }
}

function renderTest() {
  const quiz = state.activeQuiz;
  elements.runningQuizTitle.textContent = quiz.title;
  elements.answerForm.replaceChildren();

  quiz.questions.forEach((question) => {
    const card = document.createElement("article");
    card.className = "question-card";

    const title = document.createElement("div");
    title.className = "question-title";
    title.innerHTML = `<span class="question-index">${question.index}</span><h3>${escapeHtml(question.question)}</h3>`;

    const optionList = document.createElement("div");
    optionList.className = "option-list";

    question.options.forEach((option) => {
      const label = document.createElement("label");
      label.className = "option-item";
      label.innerHTML = `
        <input type="radio" name="${question.id}" value="${option.key}">
        <span><strong>${option.key}.</strong> ${escapeHtml(option.text)}</span>
      `;

      label.querySelector("input").addEventListener("change", (event) => {
        state.answers[question.id] = event.target.value;
        updateAnswerProgress();
      });

      optionList.append(label);
    });

    card.append(title, optionList);
    elements.answerForm.append(card);
  });

  updateAnswerProgress();
}

async function submitTest(isTimeout) {
  if (!state.activeQuiz) {
    return;
  }

  if (!isTimeout && !confirm("Nop bai va ket thuc bai test?")) {
    return;
  }

  stopTimer();

  const payload = {
    participantName: elements.participantNameInput.value.trim(),
    participantCode: elements.participantCodeInput.value.trim(),
    answers: state.answers
  };

  try {
    const response = await apiPost(`/api/quizzes/${encodeURIComponent(state.activeQuiz.id)}/submit`, payload);
    elements.testPanel.classList.add("hidden");
    renderScore(response.result, isTimeout);
    elements.scorePanel.classList.remove("hidden");
    state.activeQuiz = null;
    await refreshData();
    if (state.quizzes.some((quiz) => quiz.id === resultQuizId(response.result))) {
      elements.quizSelect.value = resultQuizId(response.result);
      updateSelectedQuizInfo();
    }
  } catch (error) {
    setStatus(error.message);
  }
}

function renderScore(result, isTimeout) {
  const details = result.details
    .map((detail) => {
      const className = detail.isCorrect ? "correct" : "wrong";
      const selected = detail.selectedAnswer || "-";
      return `<span class="answer-chip ${className}">Cau ${detail.index}: ${selected}/${detail.correctAnswer}</span>`;
    })
    .join("");

  elements.scorePanel.innerHTML = `
    <div class="score-box">
      <div class="score-number">${result.score}</div>
      <div>
        <h2>${isTimeout ? "Het gio, bai da tu nop" : "Da nop bai"}</h2>
        <p class="muted">${escapeHtml(result.participantName)} - dung ${result.correctCount}/${result.totalQuestions} cau.</p>
        <div class="answer-grid">${details}</div>
        <div class="score-actions">
          <button id="retryQuizButton" class="primary-button" type="button">Lam lai de nay</button>
          <button id="chooseAnotherQuizButton" class="secondary-button" type="button">Chon de khac</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("retryQuizButton").addEventListener("click", () => {
    prepareStartPanel(result.quizId);
  });
  document.getElementById("chooseAnotherQuizButton").addEventListener("click", () => {
    prepareStartPanel(elements.quizSelect.value);
  });
}

function startTimer(durationMinutes) {
  stopTimer();
  state.endsAt = Date.now() + durationMinutes * 60 * 1000;
  tickTimer();
  state.timerId = setInterval(tickTimer, 1000);
}

function tickTimer() {
  const remainingMs = Math.max(0, state.endsAt - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  elements.timerBox.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  elements.timerBox.classList.toggle("warning", totalSeconds <= 60);

  if (totalSeconds <= 0) {
    stopTimer();
    submitTest(true);
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function updateAnswerProgress() {
  if (!state.activeQuiz) {
    return;
  }

  const answered = Object.keys(state.answers).length;
  elements.answerProgress.textContent = `${answered}/${state.activeQuiz.questionCount} cau da chon`;
}

function renderQuizList() {
  elements.quizCount.textContent = `${state.quizzes.length} de`;
  elements.quizList.replaceChildren();

  if (!state.quizzes.length) {
    elements.quizList.append(emptyMessage("Chua co bai test nao. Dan TSV vao form ben tren de tao de."));
    return;
  }

  state.quizzes.forEach((quiz) => {
    const card = document.createElement("article");
    card.className = "quiz-card";
    const link = `${location.origin}/#test?quiz=${encodeURIComponent(quiz.id)}`;
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(quiz.title)}</h3>
        <div class="card-meta">
          <span class="pill">${quiz.questionCount} cau</span>
          <span class="pill">${quiz.durationMinutes} phut</span>
          <span class="copy-link">${link}</span>
        </div>
      </div>
      <button class="secondary-button" type="button">Chon de</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      prepareStartPanel(quiz.id);
      showView("test");
    });
    elements.quizList.append(card);
  });
}

function renderQuizSelect() {
  elements.quizSelect.replaceChildren();

  if (!state.quizzes.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Chua co bai test";
    elements.quizSelect.append(option);
    updateSelectedQuizInfo();
    return;
  }

  state.quizzes.forEach((quiz) => {
    const option = document.createElement("option");
    option.value = quiz.id;
    option.textContent = `${quiz.title} (${quiz.questionCount} cau, ${quiz.durationMinutes} phut)`;
    elements.quizSelect.append(option);
  });

  updateSelectedQuizInfo();
}

function renderResults() {
  elements.resultsList.replaceChildren();

  if (!state.results.length) {
    elements.resultsList.append(emptyMessage("Chua co ket qua nao."));
    return;
  }

  state.results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "result-card";
    const submitted = new Date(result.submittedAt).toLocaleString("vi-VN");
    card.innerHTML = `
      <div>
        <h3>${escapeHtml(result.participantName)} ${result.participantCode ? `(${escapeHtml(result.participantCode)})` : ""}</h3>
        <div class="card-meta">
          <span class="pill">${escapeHtml(result.quizTitle)}</span>
          <span class="pill">${result.correctCount}/${result.totalQuestions} dung</span>
          <span class="pill">${submitted}</span>
        </div>
      </div>
      <div class="score-number">${result.score}</div>
    `;
    elements.resultsList.append(card);
  });
}

function updateSelectedQuizInfo() {
  const quiz = state.quizzes.find((item) => item.id === elements.quizSelect.value);
  elements.selectedQuizInfo.textContent = quiz ? `${quiz.questionCount} cau - ${quiz.durationMinutes} phut` : "Chua chon de";
}

function prepareStartPanel(quizId) {
  stopTimer();
  state.activeQuiz = null;
  state.answers = {};
  elements.answerForm.replaceChildren();
  elements.testPanel.classList.add("hidden");
  elements.scorePanel.classList.add("hidden");
  elements.startPanel.classList.remove("hidden");

  if (quizId && state.quizzes.some((quiz) => quiz.id === quizId)) {
    elements.quizSelect.value = quizId;
  }

  updateSelectedQuizInfo();
}

function showView(name) {
  const viewName = elements.views[name] ? name : "admin";
  if (viewName === "test" && !state.activeQuiz && elements.testPanel.classList.contains("hidden")) {
    elements.startPanel.classList.remove("hidden");
  }
  elements.tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  Object.entries(elements.views).forEach(([key, view]) => view.classList.toggle("active-view", key === viewName));
  history.replaceState(null, "", `#${viewName}`);
}

function routeFromUrl() {
  const rawHash = location.hash.replace(/^#/, "");
  const [viewName, queryString] = rawHash.split("?");
  showView(viewName || "admin");

  if (viewName === "test" && queryString) {
    const params = new URLSearchParams(queryString);
    const quizId = params.get("quiz");
    if (quizId && state.quizzes.some((quiz) => quiz.id === quizId)) {
      prepareStartPanel(quizId);
    }
  }
}

function resultQuizId(result) {
  return result && result.quizId ? result.quizId : "";
}

async function apiGet(path) {
  const response = await fetch(path);
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Loi API.");
  }
  return payload;
}

async function apiPost(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(payload.error || "Loi API.");
  }
  return payload;
}

function emptyMessage(text) {
  const node = document.createElement("div");
  node.className = "panel muted";
  node.textContent = text;
  return node;
}

function setStatus(message) {
  elements.statusArea.textContent = message;
  clearTimeout(setStatus.timerId);
  setStatus.timerId = setTimeout(() => {
    elements.statusArea.textContent = "";
  }, 4500);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

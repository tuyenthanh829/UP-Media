const SHUFFLE = true;
const ALPHA = "ABCDEFGH";
const MAX_OPTIONS = 4;
const CHANNEL = "nlm-quiz-json-exporter";
const pendingRequests = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") {
    return false;
  }

  if (message.type === "SCAN_VISIBLE_QUESTION") {
    scanQuizFromReachableFrames()
      .then((response) => {
        if (!response.ok) {
          sendResponse(response);
          return;
        }

        sendResponse({
          ok: true,
          question: response.questions[0],
          count: response.count
        });
      })
      .catch((error) => {
        sendResponse(errorResponse(error));
      });
    return true;
  }

  if (message.type === "SCAN_ALL_QUESTIONS") {
    scanQuizFromReachableFrames()
      .then(sendResponse)
      .catch((error) => {
        sendResponse(errorResponse(error));
      });
    return true;
  }

  return false;
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.channel !== CHANNEL) {
    return;
  }

  if (message.type === "scan-request") {
    handleFrameScanRequest(message);
    return;
  }

  if (window.self === window.top && message.type === "scan-result") {
    const pending = pendingRequests.get(message.token);
    if (!pending) {
      return;
    }

    pendingRequests.delete(message.token);
    pending.resolve({
      ok: true,
      count: message.questions.length,
      questions: message.questions,
      sourceUrl: message.sourceUrl
    });
  }
});

async function scanQuizFromReachableFrames() {
  const localQuiz = findQuizDeep(document);
  if (localQuiz) {
    return successResponse(localQuiz, location.href);
  }

  if (window.self !== window.top) {
    return {
      ok: false,
      error: "Khong tim thay data-app-data trong frame hien tai."
    };
  }

  return requestQuizFromChildFrames();
}

function requestQuizFromChildFrames() {
  const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      pendingRequests.delete(token);
      resolve({
        ok: false,
        error:
          "Khong tim thay app QUIZ trong iframe. Hay reload NotebookLM, dam bao extension co Site access tren usercontent/goog va blob frames."
      });
    }, 10000);

    pendingRequests.set(token, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      }
    });

    broadcastToChildFrames({
      channel: CHANNEL,
      type: "scan-request",
      token
    });
  });
}

function handleFrameScanRequest(message) {
  const quiz = findQuizDeep(document);

  if (quiz) {
    window.top.postMessage(
      {
        channel: CHANNEL,
        type: "scan-result",
        token: message.token,
        questions: normalizeQuiz(quiz),
        sourceUrl: location.href
      },
      "*"
    );
    return;
  }

  broadcastToChildFrames(message);
}

function broadcastToChildFrames(message, root = document, visited = new Set()) {
  if (!root || visited.has(root)) {
    return;
  }

  visited.add(root);

  for (const frame of queryAllDeep(root, "iframe, frame")) {
    try {
      frame.contentWindow.postMessage(message, "*");
    } catch (_error) {
      // Cross-origin postMessage can still work via contentWindow; ignore failures.
    }

    try {
      const childDocument = frame.contentDocument || frame.contentWindow.document;
      if (childDocument) {
        broadcastToChildFrames(message, childDocument, visited);
      }
    } catch (_error) {
      // Cross-origin DOM access is expected for NotebookLM's frame tree.
    }
  }
}

function successResponse(quiz, sourceUrl) {
  const questions = normalizeQuiz(quiz);

  return {
    ok: true,
    count: questions.length,
    totalHint: questions.length,
    questions,
    scanNotes: [],
    sourceUrl
  };
}

function normalizeQuiz(quiz) {
  return quiz.map((question, index) => {
    let options = (question.answerOptions || []).slice(0, MAX_OPTIONS).map((option) => ({
      text: clean(option.text),
      rationale: clean(option.rationale),
      isCorrect: Boolean(option.isCorrect)
    }));

    if (SHUFFLE) {
      options = shuffleOptions(options);
    }

    let correctAnswer = "";
    options.forEach((option, optionIndex) => {
      if (option.isCorrect) {
        correctAnswer = ALPHA[optionIndex];
      }
    });

    return {
      index: index + 1,
      question: clean(question.question),
      options,
      correctAnswer,
      hint: clean(question.hint)
    };
  });
}

function shuffleOptions(options) {
  const output = options.slice();

  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }

  return output;
}

function findQuizDeep(rootDocument, visited = new Set()) {
  if (!rootDocument || visited.has(rootDocument)) {
    return null;
  }

  visited.add(rootDocument);

  const localQuiz = findQuizInDocument(rootDocument);
  if (localQuiz) {
    return localQuiz;
  }

  for (const frame of queryAllDeep(rootDocument, "iframe, frame")) {
    try {
      const childDocument = frame.contentDocument || frame.contentWindow.document;
      const childQuiz = findQuizDeep(childDocument, visited);
      if (childQuiz) {
        return childQuiz;
      }
    } catch (_error) {
      // The child content script will answer scan-request if direct DOM access is blocked.
    }
  }

  return null;
}

function findQuizInDocument(rootDocument) {
  const nodes = queryAllDeep(rootDocument, "app-root[data-app-data], [data-app-data]");
  let bestQuiz = null;

  for (const node of nodes) {
    const raw = node.getAttribute("data-app-data");
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      const quiz = getQuizArray(parsed);
      if (quiz && (!bestQuiz || quiz.length > bestQuiz.length)) {
        bestQuiz = quiz;
      }
    } catch (_error) {
      // Ignore other app payloads sharing data-app-data.
    }
  }

  return bestQuiz;
}

function getQuizArray(data) {
  const quiz = Array.isArray(data && data.quiz)
    ? data.quiz
    : Array.isArray(data && data.questions)
      ? data.questions
      : null;

  if (!Array.isArray(quiz) || quiz.length === 0) {
    return null;
  }

  return quiz.every(isQuizQuestion) ? quiz : null;
}

function isQuizQuestion(question) {
  return (
    question &&
    typeof question === "object" &&
    question.question != null &&
    Array.isArray(question.answerOptions) &&
    question.answerOptions.length > 0 &&
    question.answerOptions.every(
      (option) => option && typeof option === "object" && "text" in option
    ) &&
    question.answerOptions.some(
      (option) => option && typeof option === "object" && "isCorrect" in option
    )
  );
}

function queryAllDeep(root, selector, output = [], visited = new Set()) {
  if (!root || visited.has(root)) {
    return output;
  }

  visited.add(root);

  try {
    output.push(...root.querySelectorAll(selector));

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        queryAllDeep(element.shadowRoot, selector, output, visited);
      }
    }
  } catch (_error) {
    // Some documents can disappear during NotebookLM re-rendering.
  }

  return Array.from(new Set(output));
}

function clean(value) {
  return String(value == null ? "" : value)
    .replace(/\\ge/g, "≥")
    .replace(/\\le/g, "≤")
    .replace(/\\times/g, "×")
    .replace(/\\%/g, "%")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, " ")
    .replace(/\$/g, "")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function errorResponse(error) {
  return {
    ok: false,
    error: error && error.message ? error.message : String(error)
  };
}

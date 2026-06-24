const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5175);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const QUIZZES_FILE = path.join(DATA_DIR, "quizzes.json");
const RESULTS_FILE = path.join(DATA_DIR, "results.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
});

server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Open http://localhost:${PORT} or stop the existing server first.`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, async () => {
  await ensureDataFiles();
  console.log(`Quiz test app running at http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/quizzes") {
    const quizzes = await readJson(QUIZZES_FILE, []);
    sendJson(res, 200, {
      ok: true,
      quizzes: quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        durationMinutes: quiz.durationMinutes,
        questionCount: quiz.questions.length,
        createdAt: quiz.createdAt
      }))
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/quizzes") {
    const body = await readBodyJson(req);
    const quiz = createQuizFromTsv(body);
    const quizzes = await readJson(QUIZZES_FILE, []);
    quizzes.unshift(quiz);
    await writeJsonAtomic(QUIZZES_FILE, quizzes);
    sendJson(res, 201, { ok: true, quiz: summarizeQuiz(quiz) });
    return;
  }

  const quizMatch = url.pathname.match(/^\/api\/quizzes\/([^/]+)$/);
  if (req.method === "GET" && quizMatch) {
    const quiz = await findQuiz(quizMatch[1]);
    if (!quiz) {
      sendJson(res, 404, { ok: false, error: "Khong tim thay bai test." });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      quiz: publicQuiz(quiz)
    });
    return;
  }

  const submitMatch = url.pathname.match(/^\/api\/quizzes\/([^/]+)\/submit$/);
  if (req.method === "POST" && submitMatch) {
    const quiz = await findQuiz(submitMatch[1]);
    if (!quiz) {
      sendJson(res, 404, { ok: false, error: "Khong tim thay bai test." });
      return;
    }

    const body = await readBodyJson(req);
    const result = scoreSubmission(quiz, body);
    const results = await readJson(RESULTS_FILE, []);
    results.unshift(result);
    await writeJsonAtomic(RESULTS_FILE, results);
    sendJson(res, 201, {
      ok: true,
      result: publicResult(result)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/results") {
    const results = await readJson(RESULTS_FILE, []);
    const quizId = url.searchParams.get("quizId");
    const filtered = quizId ? results.filter((result) => result.quizId === quizId) : results;
    sendJson(res, 200, {
      ok: true,
      results: filtered.map(publicResult)
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/results.csv") {
    const results = await readJson(RESULTS_FILE, []);
    const quizId = url.searchParams.get("quizId");
    const filtered = quizId ? results.filter((result) => result.quizId === quizId) : results;
    sendDownloadText(res, 200, `\uFEFF${resultsToCsv(filtered)}`, "text/csv; charset=utf-8", "quiz-results.csv");
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/results.xls") {
    const results = await readJson(RESULTS_FILE, []);
    const quizId = url.searchParams.get("quizId");
    const filtered = quizId ? results.filter((result) => result.quizId === quizId) : results;
    sendDownloadText(
      res,
      200,
      resultsToExcelHtml(filtered),
      "application/vnd.ms-excel; charset=utf-8",
      "quiz-results.xls"
    );
    return;
  }

  sendJson(res, 404, { ok: false, error: "API khong ton tai." });
}

function createQuizFromTsv(body) {
  const title = cleanText(body && body.title) || "Bai test moi";
  const durationMinutes = clampNumber(Number(body && body.durationMinutes), 1, 240, 30);
  const tsv = String((body && body.tsv) || "").trim();
  const rows = parseTsv(tsv);

  if (rows.length < 2) {
    throw new Error("TSV phai co header va it nhat 1 cau hoi.");
  }

  const header = rows[0].map(normalizeHeader);
  const findColumn = (...names) => names.map(normalizeHeader).map((name) => header.indexOf(name)).find((index) => index >= 0);
  const hasFixedNotebookColumns = rows[0].length >= 12;
  const fallbackColumn = (foundIndex, fixedIndex) =>
    foundIndex == null || foundIndex < 0 ? (hasFixedNotebookColumns ? fixedIndex : -1) : foundIndex;
  const indexQuestion = fallbackColumn(findColumn("Câu hỏi", "Cau hoi", "question"), 1);
  const indexCorrect = fallbackColumn(findColumn("Đáp án đúng", "Dap an dung", "correct_answer"), 6);
  const indexHint = fallbackColumn(findColumn("Gợi ý", "Goi y", "hint"), 11);

  if (indexQuestion == null || indexQuestion < 0 || indexCorrect == null || indexCorrect < 0) {
    throw new Error("TSV thieu cot Cau hoi hoac Dap an dung.");
  }

  const optionIndexes = ["A", "B", "C", "D"].map((key, index) =>
    fallbackColumn(findColumn(`Phương án ${key}`, `Phuong an ${key}`, `option_${key.toLowerCase()}`), index + 2)
  );
  const rationaleIndexes = ["A", "B", "C", "D"].map((key, index) =>
    fallbackColumn(findColumn(`Giải thích ${key}`, `Giai thich ${key}`, `rationale_${key.toLowerCase()}`), index + 7)
  );
  const questions = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const prompt = cleanText(row[indexQuestion]);
    if (!prompt) {
      return;
    }

    const options = optionIndexes
      .map((columnIndex, optionIndex) => ({
        key: ["A", "B", "C", "D"][optionIndex],
        text: cleanText(row[columnIndex]),
        rationale: cleanText(row[rationaleIndexes[optionIndex]])
      }))
      .filter((option) => option.text);

    const correctAnswer = normalizeAnswer(row[indexCorrect]);
    if (!options.length || !options.some((option) => option.key === correctAnswer)) {
      throw new Error(`Dong ${rowIndex + 2} thieu phuong an hoac dap an dung khong hop le.`);
    }

    questions.push({
      id: crypto.randomUUID(),
      question: prompt,
      options,
      correctAnswer,
      hint: indexHint >= 0 ? cleanText(row[indexHint]) : ""
    });
  });

  if (!questions.length) {
    throw new Error("Khong doc duoc cau hoi nao tu TSV.");
  }

  return {
    id: makeId(title),
    title,
    durationMinutes,
    questions,
    createdAt: new Date().toISOString()
  };
}

function scoreSubmission(quiz, body) {
  const participantName = cleanText(body && body.participantName);
  const participantCode = cleanText(body && body.participantCode);
  const answers = body && typeof body.answers === "object" ? body.answers : {};

  if (!participantName) {
    throw new Error("Can nhap ten nguoi lam bai.");
  }

  const details = quiz.questions.map((question, index) => {
    const selectedAnswer = normalizeAnswer(answers[question.id]);
    const isCorrect = selectedAnswer === question.correctAnswer;

    return {
      index: index + 1,
      questionId: question.id,
      selectedAnswer,
      correctAnswer: question.correctAnswer,
      isCorrect
    };
  });
  const correctCount = details.filter((item) => item.isCorrect).length;
  const score = roundScore((correctCount / quiz.questions.length) * 100);

  return {
    id: crypto.randomUUID(),
    quizId: quiz.id,
    quizTitle: quiz.title,
    participantName,
    participantCode,
    submittedAt: new Date().toISOString(),
    totalQuestions: quiz.questions.length,
    correctCount,
    score,
    details
  };
}

function publicQuiz(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questions.length,
    questions: quiz.questions.map((question, index) => ({
      id: question.id,
      index: index + 1,
      question: question.question,
      options: question.options.map((option) => ({
        key: option.key,
        text: option.text
      }))
    }))
  };
}

function publicResult(result) {
  return {
    id: result.id,
    quizId: result.quizId,
    quizTitle: result.quizTitle,
    participantName: result.participantName,
    participantCode: result.participantCode,
    submittedAt: result.submittedAt,
    totalQuestions: result.totalQuestions,
    correctCount: result.correctCount,
    score: result.score,
    details: result.details
  };
}

function summarizeQuiz(quiz) {
  return {
    id: quiz.id,
    title: quiz.title,
    durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questions.length,
    createdAt: quiz.createdAt
  };
}

function parseTsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map(cleanText))
    .filter((row) => row.some(Boolean));
}

function normalizeHeader(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeAnswer(value) {
  const answer = cleanText(value).toUpperCase().slice(0, 1);
  return /^[A-D]$/.test(answer) ? answer : "";
}

function cleanText(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundScore(value) {
  return Math.round(value * 100) / 100;
}

function makeId(title) {
  const slug = cleanText(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return `${slug || "quiz"}-${crypto.randomBytes(4).toString("hex")}`;
}

function resultsToCsv(results) {
  const rows = resultRows(results);

  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function resultsToExcelHtml(results) {
  const rows = resultRows(results);
  const tableRows = rows
    .map((row, rowIndex) => {
      const tagName = rowIndex === 0 ? "th" : "td";
      const cells = row.map((cell) => `<${tagName}>${escapeHtml(cell)}</${tagName}>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; }
    th { background: #eaf1ff; font-weight: bold; }
  </style>
</head>
<body>
  <table>${tableRows}</table>
</body>
</html>`;
}

function resultRows(results) {
  const maxDetails = results.reduce((max, result) => Math.max(max, (result.details || []).length), 0);
  const header = [
    "submitted_at",
    "quiz_title",
    "participant_name",
    "participant_code",
    "score",
    "correct_count",
    "total_questions"
  ];

  for (let index = 1; index <= maxDetails; index += 1) {
    header.push(`q${index}_selected`, `q${index}_correct`, `q${index}_result`);
  }

  const rows = [header];

  results.forEach((result) => {
    const row = [
      result.submittedAt,
      result.quizTitle,
      result.participantName,
      result.participantCode,
      result.score,
      result.correctCount,
      result.totalQuestions
    ];

    for (let index = 0; index < maxDetails; index += 1) {
      const detail = (result.details || [])[index];
      row.push(
        detail ? detail.selectedAnswer || "-" : "",
        detail ? detail.correctAnswer || "" : "",
        detail ? (detail.isCorrect ? "correct" : "wrong") : ""
      );
    }

    rows.push(row);
  });

  return rows;
}

function csvCell(value) {
  const text = String(value == null ? "" : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      throw new Error("Not file");
    }

    const ext = path.extname(filePath).toLowerCase();
    const data = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  } catch (_error) {
    const data = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    res.end(data);
  }
}

async function findQuiz(quizId) {
  const quizzes = await readJson(QUIZZES_FILE, []);
  return quizzes.find((quiz) => quiz.id === quizId) || null;
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await ensureJsonFile(QUIZZES_FILE, []);
  await ensureJsonFile(RESULTS_FILE, []);
}

async function ensureJsonFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (_error) {
    await writeJsonAtomic(filePath, fallback);
  }
}

async function readBodyJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempFile = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, filePath);
}

function sendJson(res, statusCode, payload) {
  sendText(res, statusCode, JSON.stringify(payload), "application/json; charset=utf-8");
}

function sendText(res, statusCode, text, contentType) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function sendDownloadText(res, statusCode, text, contentType, fileName) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store"
  });
  res.end(text);
}

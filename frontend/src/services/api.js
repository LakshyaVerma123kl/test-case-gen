import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request logging
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response logging & error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API Response Error:", error);
    if (error.response) {
      throw new Error(error.response.data?.error || "An error occurred");
    } else if (error.request) {
      throw new Error("No response from server. Please check your connection.");
    } else {
      throw new Error(error.message || "Unexpected error");
    }
  }
);

//
// ─── AUTH ────────────────────────────────────────────────
//
export const authenticateGitHub = async (token) => {
  // Pass token directly to backend
  return await api.post("/auth/github", { token });
};

export const validateSession = async (sessionId) => {
  return await api.get(`/auth/status`, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
};

export const logout = async (sessionId) => {
  return await api.post(
    "/auth/logout",
    {},
    { headers: { Authorization: `Bearer ${sessionId}` } }
  );
};

//
// ─── GITHUB ──────────────────────────────────────────────
//
export const getUserRepositories = async (sessionId) => {
  return await api.get(`/github/repos`, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
};

export const getRepositoryTree = async (
  owner,
  repo,
  sessionId,
  path = "",
  recursive = false
) => {
  return await api.get(`/github/repos/${owner}/${repo}/tree`, {
    params: { path, recursive: recursive.toString() },
    headers: { Authorization: `Bearer ${sessionId}` },
  });
};

export const getFileContent = async (owner, repo, filePath, sessionId) => {
  return await api.get(`/github/repos/${owner}/${repo}/contents/${filePath}`, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
};

export const createPullRequest = async (owner, repo, sessionId, prData) => {
  return await api.post(`/github/repos/${owner}/${repo}/pulls`, prData, {
    headers: { Authorization: `Bearer ${sessionId}` },
  });
};

//
// ─── TEST CASES ──────────────────────────────────────────
//
export const generateTestCaseSummaries = async (
  files,
  language = "auto",
  testFramework = "auto"
) => {
  return await api.post("/testcases/generate-summaries", {
    files,
    language,
    testFramework,
  });
};

export const generateTestCases = async (files, config = {}) => {
  return await api.post("/testcases/generate", { files, config });
};

export const downloadTestCasesAsJSON = (testCases) => {
  const blob = new Blob([JSON.stringify(testCases, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "testcases.json";
  link.click();
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Copy failed", err);
    return false;
  }
};

export const generateTestCaseSummary = async (testCases, metadata = {}) => {
  return await api.post("/testcases/summary", { testCases, metadata });
};

export const exportSummaryReport = (summary) => {
  const blob = new Blob([JSON.stringify(summary, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "summary_report.json";
  link.click();
};

export const getTestCaseMetrics = async (testCases) => {
  return await api.post("/testcases/metrics", { testCases });
};

export const generateTestCode = async (fileData) => {
  return await api.post("/testcases/generate-code", fileData);
};

export const recommendTestFramework = async (files) => {
  return await api.post("/testcases/recommend-framework", { files });
};

//
// ─── UTILITIES ──────────────────────────────────────────
//
export const healthCheck = async () => {
  return await api.get("/health");
};

export const processSelectedFiles = async (selectedFiles, sessionId) => {
  const filesWithContent = [];
  for (const file of selectedFiles) {
    try {
      const fileContent = await getFileContent(
        file.owner,
        file.repo,
        file.path,
        sessionId
      );
      filesWithContent.push({
        path: file.path,
        content: fileContent.file.content,
        size: fileContent.file.size,
        language: detectLanguageFromPath(file.path),
      });
    } catch (error) {
      console.error(`Failed to fetch ${file.path}:`, error);
    }
  }
  return filesWithContent;
};

export const detectLanguageFromPath = (filePath) => {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const map = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    vue: "vue",
    svelte: "svelte",
  };
  return map[ext] || "unknown";
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getLanguageIcon = (language) => {
  const icons = {
    javascript: "📜",
    typescript: "📘",
    python: "🐍",
    java: "☕",
    cpp: "⚡",
    c: "🔧",
    csharp: "🎯",
    php: "🐘",
    ruby: "💎",
    go: "🐹",
    rust: "🦀",
    swift: "🍎",
    kotlin: "🎨",
    scala: "⚖️",
    vue: "💚",
    svelte: "🧡",
  };
  return icons[language] || "📄";
};

export default api;

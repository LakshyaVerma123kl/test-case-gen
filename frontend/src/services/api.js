import axios from "axios";

// Get API URL from environment variables
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

console.log("🌐 API Base URL:", API_BASE_URL);

// Axios instance with improved error handling
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased timeout for slower deployments
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor with better logging
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(
        `🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${
          config.url
        }`
      );
      if (config.data && Object.keys(config.data).length > 0) {
        console.log("📦 Request data:", Object.keys(config.data));
      }
    }
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor with detailed error handling
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(
        `✅ API Response: ${
          response.status
        } ${response.config.method?.toUpperCase()} ${response.config.url}`
      );
    }
    return response.data;
  },
  (error) => {
    console.error("❌ API Response Error:", error);

    // Handle different types of errors
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response;
      console.error(`HTTP ${status}:`, data);

      // Create meaningful error messages
      let errorMessage = data?.error || data?.message || `HTTP ${status} Error`;

      if (status === 401) {
        errorMessage = "Authentication failed. Please check your GitHub token.";
      } else if (status === 403) {
        errorMessage =
          "Permission denied. Please check your GitHub token permissions.";
      } else if (status === 404) {
        errorMessage = "Resource not found.";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (status >= 500) {
        errorMessage = "Server error. Please try again later.";
      }

      throw new Error(errorMessage);
    } else if (error.request) {
      // Network error
      console.error("Network error:", error.request);
      throw new Error(
        "Unable to connect to server. Please check your internet connection."
      );
    } else {
      // Other errors
      throw new Error(error.message || "An unexpected error occurred");
    }
  }
);

//
// ─── AUTH FUNCTIONS ─────────────────────────────────────
//

export const authenticateGitHub = async (token) => {
  try {
    console.log("🔐 Authenticating with GitHub...");

    if (!token || typeof token !== "string") {
      throw new Error("GitHub token is required");
    }

    // Clean the token (remove whitespace)
    const cleanToken = token.trim();

    if (
      !cleanToken.startsWith("ghp_") &&
      !cleanToken.startsWith("github_pat_")
    ) {
      throw new Error(
        'Invalid GitHub token format. Token should start with "ghp_" or "github_pat_"'
      );
    }

    const response = await api.post("/auth/github", {
      token: cleanToken,
    });

    console.log("🔍 Auth response:", response);

    // Handle different response formats
    if (response && typeof response === "object") {
      // Check for explicit success field
      if (response.hasOwnProperty("success")) {
        if (!response.success) {
          throw new Error(
            response.error || response.message || "Authentication failed"
          );
        }
        console.log("✅ GitHub authentication successful");
        return response;
      }
      // Check for error field even if success is not present
      else if (response.error) {
        throw new Error(response.error);
      }
      // Check for common error indicators
      else if (response.status === "error" || response.ok === false) {
        throw new Error(
          response.message || response.error || "Authentication failed"
        );
      }
      // If response has user data, consider it successful and normalize the response
      else if (response.user || response.sessionId) {
        console.log("✅ GitHub authentication successful");
        // Normalize the response to include success field for compatibility
        return {
          success: true,
          user: response.user,
          sessionId: response.sessionId,
          expiresIn: response.expiresIn,
          ...response,
        };
      }
    }

    // If we get here and have a response, assume success and normalize
    if (response) {
      console.log("✅ GitHub authentication successful");
      return {
        success: true,
        ...response,
      };
    }

    // No response or invalid response
    throw new Error("Invalid response from authentication server");
  } catch (error) {
    console.error("❌ GitHub authentication failed:", error.message);
    throw error;
  }
};

export const validateSession = async (sessionId) => {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const response = await api.get("/auth/status", {
      headers: { Authorization: `Bearer ${sessionId}` },
    });

    return response;
  } catch (error) {
    console.error("❌ Session validation failed:", error.message);
    throw error;
  }
};

export const logout = async (sessionId) => {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const response = await api.post(
      "/auth/logout",
      {},
      {
        headers: { Authorization: `Bearer ${sessionId}` },
      }
    );

    console.log("✅ Logout successful");
    return response;
  } catch (error) {
    console.error("❌ Logout failed:", error.message);
    throw error;
  }
};

//
// ─── GITHUB FUNCTIONS ───────────────────────────────────
//

export const getUserRepositories = async (sessionId) => {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    console.log("🔍 Fetching repositories...");
    const response = await api.get("/github/repos", {
      headers: { Authorization: `Bearer ${sessionId}` },
    });

    console.log("🔍 Raw API Response:", response);

    // Improved response handling to match your backend structure
    if (response && response.success) {
      // If the response indicates success and has repos
      if (Array.isArray(response.repos)) {
        console.log(
          "✅ Found repositories in response.repos:",
          response.repos.length
        );
        return {
          success: true,
          repos: response.repos,
        };
      }
      // If repositories are directly in the response data
      if (Array.isArray(response.repositories)) {
        console.log(
          "✅ Found repositories in response.repositories:",
          response.repositories.length
        );
        return {
          success: true,
          repos: response.repositories,
        };
      }
    }

    // If response is already an array (direct repository list)
    if (Array.isArray(response)) {
      console.log("✅ Response is direct array:", response.length);
      return {
        success: true,
        repos: response,
      };
    }

    // If repositories are nested in data
    if (response && response.data && Array.isArray(response.data)) {
      console.log(
        "✅ Found repositories in response.data:",
        response.data.length
      );
      return {
        success: true,
        repos: response.data,
      };
    }

    // Handle error responses
    if (response && !response.success && response.error) {
      throw new Error(response.error);
    }

    // Log what we actually got and return empty but successful response
    console.warn(
      "🚨 Unexpected response structure, returning empty repos:",
      response
    );
    return {
      success: true,
      repos: [],
    };
  } catch (error) {
    console.error("❌ Failed to fetch repositories:", error.message);
    throw error;
  }
};

export const getRepositoryTree = async (
  repoFullName,
  sessionId,
  path = "",
  recursive = false
) => {
  try {
    if (!repoFullName || !sessionId) {
      throw new Error("Repository name and session ID are required");
    }

    // Split the full name to get owner and repo
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repository format. Expected 'owner/repo'");
    }

    const response = await api.get(`/github/repos/${owner}/${repo}/tree`, {
      params: { path, recursive: recursive.toString() },
      headers: { Authorization: `Bearer ${sessionId}` },
    });

    // Handle different response formats
    if (response && response.tree) {
      return response.tree;
    }
    if (Array.isArray(response)) {
      return response;
    }
    if (response && response.data && Array.isArray(response.data)) {
      return response.data;
    }

    throw new Error("Invalid tree response format");
  } catch (error) {
    console.error("❌ Failed to fetch repository tree:", error.message);
    throw error;
  }
};

export const getFileContent = async (owner, repo, filePath, sessionId) => {
  try {
    if (!owner || !repo || !filePath || !sessionId) {
      throw new Error(
        "Owner, repository name, file path, and session ID are required"
      );
    }

    const response = await api.get(
      `/github/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: { Authorization: `Bearer ${sessionId}` },
      }
    );

    return response;
  } catch (error) {
    console.error(
      `❌ Failed to fetch file content for ${filePath}:`,
      error.message
    );
    throw error;
  }
};

export const createPullRequest = async (owner, repo, sessionId, prData) => {
  try {
    if (!owner || !repo || !sessionId || !prData) {
      throw new Error(
        "All parameters are required for creating a pull request"
      );
    }

    const response = await api.post(
      `/github/repos/${owner}/${repo}/pulls`,
      prData,
      {
        headers: { Authorization: `Bearer ${sessionId}` },
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to create pull request:", error.message);
    throw error;
  }
};

//
// ─── TEST CASE FUNCTIONS ────────────────────────────────
//

export const generateTestCases = async (config) => {
  try {
    const { sessionId, files, ...restConfig } = config;

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error("Files array is required and must not be empty");
    }

    console.log(`🧪 Generating test cases for ${files.length} files...`);

    const response = await api.post(
      "/testcases/generate",
      { files, ...restConfig },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 120000, // 2 minutes for AI generation
      }
    );

    console.log("✅ Test cases generated successfully");
    return response;
  } catch (error) {
    console.error("❌ Failed to generate test cases:", error.message);
    throw error;
  }
};

export const generateRepositoryTestCases = async (
  sessionId,
  owner,
  repo,
  options = {}
) => {
  try {
    if (!sessionId || !owner || !repo) {
      throw new Error("Session ID, owner, and repository name are required");
    }

    console.log(`🧪 Generating test cases for repository ${owner}/${repo}...`);

    const response = await api.post(
      "/testcases/generate/repository",
      { owner, repo, ...options },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 180000, // 3 minutes for repository analysis
      }
    );

    console.log("✅ Repository test cases generated successfully");
    return response;
  } catch (error) {
    console.error(
      "❌ Failed to generate repository test cases:",
      error.message
    );
    throw error;
  }
};

export const generateFileTestCases = async (
  sessionId,
  owner,
  repo,
  filePath,
  options = {}
) => {
  try {
    if (!sessionId || !owner || !repo || !filePath) {
      throw new Error("All parameters are required");
    }

    console.log(`🧪 Generating test cases for file ${filePath}...`);

    const response = await api.post(
      "/testcases/generate/file",
      { owner, repo, path: filePath, ...options },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 120000, // 2 minutes for file analysis
      }
    );

    console.log("✅ File test cases generated successfully");
    return response;
  } catch (error) {
    console.error("❌ Failed to generate file test cases:", error.message);
    throw error;
  }
};

export const getTestSuggestions = async (
  sessionId,
  files,
  projectStructure = null
) => {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const response = await api.post(
      "/testcases/suggestions",
      { files, projectStructure },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to get test suggestions:", error.message);
    throw error;
  }
};

export const getTestFrameworks = async () => {
  try {
    const response = await api.get("/testcases/frameworks");
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch test frameworks:", error.message);
    throw error;
  }
};

export const getTestTypes = async () => {
  try {
    const response = await api.get("/testcases/types");
    return response;
  } catch (error) {
    console.error("❌ Failed to fetch test types:", error.message);
    throw error;
  }
};

//
// ─── SUMMARY FUNCTIONS ─────────────────────────────────
//

export const generateTestCaseSummary = async (config) => {
  try {
    const { sessionId, testCases, repository, files } = config;

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    const response = await api.post(
      "/testcases/summary",
      { testCases, repository, files },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 60000, // 1 minute for summary generation
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to generate summary:", error.message);
    throw error;
  }
};

export const getTestCaseMetrics = async (sessionId, testCases) => {
  try {
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    if (!testCases || !Array.isArray(testCases)) {
      throw new Error("Test cases array is required");
    }

    const response = await api.post(
      "/testcases/metrics",
      { testCases },
      {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 30000, // 30 seconds for metrics calculation
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Failed to get test case metrics:", error.message);
    throw error;
  }
};

export const exportSummaryReport = async ({
  testCases,
  summary,
  metrics,
  repository,
}) => {
  try {
    const reportData = {
      metadata: {
        repository,
        generatedAt: new Date().toISOString(),
        totalTestCases: testCases.length,
      },
      testCases,
      summary,
      metrics,
    };

    const filename = `test-summary-${repository || "project"}-${
      new Date().toISOString().split("T")[0]
    }.json`;

    await downloadTestCasesAsJSON(reportData, filename);
    console.log("✅ Summary report exported successfully");
  } catch (error) {
    console.error("❌ Failed to export summary report:", error.message);
    throw error;
  }
};

//
// ─── UTILITY FUNCTIONS ──────────────────────────────────
//

export const healthCheck = async () => {
  try {
    const response = await api.get("/health");
    return response;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    throw error;
  }
};

export const processSelectedFiles = async (selectedFiles, sessionId) => {
  if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
    throw new Error("Selected files array is required");
  }

  const filesWithContent = [];
  const errors = [];

  for (const file of selectedFiles) {
    try {
      console.log(`📄 Fetching content for ${file.path}...`);

      // Extract owner and repo from the file object
      const owner = file.owner;
      const repo = file.repo;

      const fileContent = await getFileContent(
        owner,
        repo,
        file.path,
        sessionId
      );

      if (fileContent.success && fileContent.file) {
        filesWithContent.push({
          path: file.path,
          name: file.name || file.path.split("/").pop(),
          content: fileContent.file.decodedContent,
          size: fileContent.file.size,
          language: detectLanguageFromPath(file.path),
          owner: file.owner,
          repo: file.repo,
        });
      }
    } catch (error) {
      console.error(`❌ Failed to fetch ${file.path}:`, error.message);
      errors.push({
        file: file.path,
        error: error.message,
      });
    }
  }

  return {
    files: filesWithContent,
    errors,
    totalRequested: selectedFiles.length,
    totalFetched: filesWithContent.length,
  };
};

export const detectLanguageFromPath = (filePath) => {
  if (!filePath) return "unknown";

  const ext = filePath.split(".").pop()?.toLowerCase();
  const languageMap = {
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
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    md: "markdown",
    txt: "text",
  };

  return languageMap[ext] || "unknown";
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
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
    html: "🌐",
    css: "🎨",
    json: "📋",
    yaml: "⚙️",
    markdown: "📝",
    unknown: "📄",
  };
  return icons[language] || icons.unknown;
};

// Export/Download utilities
export const downloadTestCasesAsJSON = (
  testCases,
  filename = "testcases.json"
) => {
  try {
    const blob = new Blob([JSON.stringify(testCases, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    console.log("✅ Test cases downloaded successfully");
  } catch (error) {
    console.error("❌ Failed to download test cases:", error);
    throw new Error("Failed to download test cases");
  }
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log("✅ Copied to clipboard");
    return true;
  } catch (err) {
    console.error("❌ Copy to clipboard failed:", err);

    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackErr) {
      console.error("❌ Fallback copy failed:", fallbackErr);
      return false;
    }
  }
};

// Error handling utility
export const handleApiError = (error, context = "API call") => {
  console.error(`❌ ${context} failed:`, error);

  // Extract meaningful error message
  let message = "An unexpected error occurred";

  if (error.message) {
    message = error.message;
  }

  // Add context if available
  if (context && context !== "API call") {
    message = `${context}: ${message}`;
  }

  return {
    error: true,
    message,
    timestamp: new Date().toISOString(),
  };
};

export default api;

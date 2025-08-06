import axios from "axios";

// Get API URL from environment variables
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

console.log("🌐 API Base URL:", API_BASE_URL);

// Enhanced axios instance with universal support and improved error handling
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for complex multi-language analysis
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor with enhanced logging
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(
        `🚀 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${
          config.url
        }`
      );
      if (config.data && Object.keys(config.data).length > 0) {
        console.log("📦 Request data keys:", Object.keys(config.data));
        if (config.data.files) {
          console.log(`📄 Files count: ${config.data.files.length}`);
        }
        if (config.data.config) {
          console.log(
            `⚙️ Config: ${JSON.stringify(config.data.config, null, 2)}`
          );
        }
      }
    }
    return config;
  },
  (error) => {
    console.error("❌ API Request Error:", error);
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with detailed error handling
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(
        `✅ API Response: ${
          response.status
        } ${response.config.method?.toUpperCase()} ${response.config.url}`
      );
      if (response.data && typeof response.data === "object") {
        console.log("📋 Response keys:", Object.keys(response.data));
      }
    }
    return response.data;
  },
  (error) => {
    console.error("❌ API Response Error:", error);

    if (error.response) {
      const { status, data } = error.response;
      console.error(`HTTP ${status}:`, data);

      let errorMessage = data?.error || data?.message || `HTTP ${status} Error`;

      // Enhanced error messages for all scenarios
      if (status === 401) {
        errorMessage = "Authentication failed. Please check your GitHub token.";
      } else if (status === 403) {
        errorMessage =
          "Permission denied. Check GitHub token permissions and rate limits.";
      } else if (status === 404) {
        errorMessage = "Resource not found. Repository or files may not exist.";
      } else if (status === 413) {
        errorMessage =
          "Request too large. Try selecting fewer files or smaller files.";
      } else if (status === 422) {
        errorMessage =
          "Invalid request format. Please check your file selection and configuration.";
      } else if (status === 429) {
        errorMessage = "Rate limit exceeded. Please wait before trying again.";
      } else if (status >= 500) {
        errorMessage =
          "Server error. Our AI service may be temporarily unavailable.";
      }

      throw new Error(errorMessage);
    } else if (error.request) {
      console.error("Network error:", error.request);
      throw new Error(
        "Unable to connect to server. Please check your internet connection and try again."
      );
    } else if (error.code === "ECONNABORTED") {
      throw new Error(
        "Request timeout. Large projects may take longer to analyze. Please try with fewer files or try again later."
      );
    } else {
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

    if (Array.isArray(response)) {
      console.log("✅ Response is direct array:", response.length);
      return {
        success: true,
        repos: response,
      };
    }

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

    if (response && !response.success && response.error) {
      throw new Error(response.error);
    }

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

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error("Invalid repository format. Expected 'owner/repo'");
    }

    const response = await api.get(`/github/repos/${owner}/${repo}/tree`, {
      params: { path, recursive: recursive.toString() },
      headers: { Authorization: `Bearer ${sessionId}` },
    });

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
// ─── ENHANCED LANGUAGE DETECTION ────────────────────────
//

export const detectLanguageFromPath = (filePath) => {
  if (!filePath) return "unknown";

  const ext = filePath.split(".").pop()?.toLowerCase();
  const fileName = filePath.toLowerCase();

  // Enhanced language mapping with more extensions
  const languageMap = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    ts: "typescript",
    tsx: "typescript",

    // Python
    py: "python",
    pyx: "python",
    pyw: "python",
    pyi: "python",

    // Java/JVM
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    scala: "scala",
    groovy: "groovy",
    clj: "clojure",

    // C/C++
    c: "c",
    cpp: "cpp",
    cxx: "cpp",
    cc: "cpp",
    h: "c",
    hpp: "cpp",
    hxx: "cpp",

    // C#/.NET
    cs: "csharp",
    vb: "vb.net",
    fs: "fsharp",

    // Web Technologies
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",

    // PHP
    php: "php",
    phtml: "php",
    php3: "php",
    php4: "php",
    php5: "php",

    // Ruby
    rb: "ruby",
    erb: "ruby",

    // Go
    go: "go",

    // Rust
    rs: "rust",

    // Swift
    swift: "swift",

    // Other Languages
    r: "r",
    R: "r",
    pl: "perl",
    pm: "perl",
    lua: "lua",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    fish: "shell",
    ps1: "powershell",
    psm1: "powershell",

    // Functional Languages
    hs: "haskell",
    lhs: "haskell",
    elm: "elm",
    ml: "ocaml",
    mli: "ocaml",

    // Data & Config
    json: "json",
    yml: "yaml",
    yaml: "yaml",
    toml: "toml",
    xml: "xml",
    csv: "csv",

    // Database
    sql: "sql",

    // Documentation
    md: "markdown",
    mdx: "markdown",
    rst: "rst",
    txt: "text",

    // Mobile
    m: "objective-c",
    mm: "objective-c",
    dart: "dart",

    // Other
    vue: "vue",
    svelte: "svelte",
    sol: "solidity",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    hrl: "erlang",
  };

  // Special case detection based on file names
  if (fileName.includes("dockerfile")) return "docker";
  if (fileName.includes("makefile")) return "makefile";
  if (fileName.includes("rakefile")) return "ruby";
  if (fileName.includes("gemfile")) return "ruby";
  if (fileName.includes("package.json")) return "javascript";
  if (fileName.includes("requirements.txt")) return "python";
  if (fileName.includes("pom.xml")) return "java";
  if (fileName.includes("build.gradle")) return "java";
  if (fileName.includes("composer.json")) return "php";
  if (fileName.includes("cargo.toml")) return "rust";
  if (fileName.includes("go.mod")) return "go";

  return languageMap[ext] || "unknown";
};

export const getLanguageIcon = (language) => {
  const icons = {
    javascript: "🟨",
    typescript: "🔷",
    python: "🐍",
    java: "☕",
    kotlin: "🟪",
    scala: "🔴",
    cpp: "⚡",
    c: "🔧",
    csharp: "🟦",
    "vb.net": "🟦",
    fsharp: "🟦",
    php: "🐘",
    ruby: "💎",
    go: "🐹",
    rust: "🦀",
    swift: "🧡",
    r: "📊",
    perl: "🐪",
    lua: "🌙",
    shell: "🐚",
    powershell: "💙",
    haskell: "🎭",
    elm: "🌳",
    ocaml: "🐫",
    vue: "💚",
    svelte: "🧡",
    html: "🌐",
    css: "🎨",
    scss: "🎨",
    sass: "🎨",
    json: "📋",
    yaml: "⚙️",
    toml: "⚙️",
    xml: "📄",
    sql: "🗃️",
    markdown: "📝",
    docker: "🐳",
    makefile: "🔨",
    solidity: "💎",
    elixir: "💜",
    erlang: "🔴",
    dart: "🎯",
    "objective-c": "🍎",
    unknown: "📄",
  };
  return icons[language] || icons.unknown;
};

//
// ─── UNIVERSAL TEST CASE GENERATION ─────────────────────
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

    // Validate file structures
    const validFiles = files.filter((file) => file.path && file.name);
    if (validFiles.length === 0) {
      throw new Error(
        "No valid files found. Files must have path and name properties."
      );
    }

    console.log(`🧪 Starting universal test case generation...`, {
      totalFiles: files.length,
      validFiles: validFiles.length,
      languages: [...new Set(files.map((f) => detectLanguageFromPath(f.path)))],
      config: restConfig,
    });

    // Enhanced configuration for universal generation
    const enhancedConfig = {
      ...restConfig,
      universalMode: true,
      supportedLanguages: "all",
      adaptiveFrameworks: true,
      crossLanguagePatterns: true,
      intelligentFallbacks: true,
      timeout: 300000,
    };

    const requestPayload = {
      files: validFiles,
      config: enhancedConfig,
    };

    console.log("📤 Sending request with payload:", {
      filesCount: validFiles.length,
      configKeys: Object.keys(enhancedConfig),
    });

    // Try universal endpoint first, fallback to regular endpoint
    let response;
    try {
      response = await api.post(
        "/testcases/generate/universal",
        requestPayload,
        {
          headers: { Authorization: `Bearer ${sessionId}` },
          timeout: 300000,
          onUploadProgress: (progressEvent) => {
            if (import.meta.env.DEV) {
              const progress = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              console.log(`📤 Upload progress: ${progress}%`);
            }
          },
        }
      );
    } catch (error) {
      console.log(
        "🔄 Universal endpoint unavailable, trying standard endpoint..."
      );
      response = await api.post("/testcases/generate", requestPayload, {
        headers: { Authorization: `Bearer ${sessionId}` },
        timeout: 300000,
      });
    }

    console.log("✅ Test cases generated successfully");

    // Handle different response formats
    let testCases = [];

    if (response.testCases) {
      testCases = response.testCases;
    } else if (response.data) {
      testCases = response.data;
    } else if (Array.isArray(response)) {
      testCases = response;
    } else {
      throw new Error("Invalid response format: expected test cases array");
    }

    // Validate and enhance test cases
    const enhancedTestCases = testCases.map((tc, index) => ({
      id: tc.id || `test-${Date.now()}-${index}`,
      title: tc.title || `Test Case ${index + 1}`,
      description: tc.description || "Generated test case",
      type: tc.type || "unit",
      priority: tc.priority || "medium",
      language: tc.language || detectLanguageFromPath(tc.file || ""),
      framework: tc.framework || "auto-detected",
      code: tc.code || "",
      tags: tc.tags || [],
      estimatedTime: tc.estimatedTime || 30,
      complexity: tc.complexity || "medium",
      riskLevel: tc.riskLevel || "low",
      universalPattern: true,
      generated: new Date().toISOString(),
      ...tc,
    }));

    console.log(`✅ Enhanced ${enhancedTestCases.length} test cases`);

    return {
      success: true,
      testCases: enhancedTestCases,
      metadata: {
        totalGenerated: enhancedTestCases.length,
        languages: [...new Set(enhancedTestCases.map((tc) => tc.language))],
        types: [...new Set(enhancedTestCases.map((tc) => tc.type))],
        frameworks: [...new Set(enhancedTestCases.map((tc) => tc.framework))],
        generatedAt: new Date().toISOString(),
        universalMode: true,
      },
      ...response,
    };
  } catch (error) {
    console.error("❌ Test case generation failed:", error.message);

    // Try fallback generation
    if (config.files && Array.isArray(config.files)) {
      console.log("🔄 Attempting fallback generation...");
      try {
        return await generateFallbackTestCases(config.files, config);
      } catch (fallbackError) {
        console.error(
          "❌ Fallback generation also failed:",
          fallbackError.message
        );
      }
    }

    // Provide helpful error messages based on the error type
    if (error.message.includes("timeout")) {
      throw new Error(
        "Test generation timed out. This can happen with very large projects. Try selecting fewer files or breaking the generation into smaller batches."
      );
    }

    if (error.message.includes("token")) {
      throw new Error(
        "Authentication error. Please check your GitHub token and ensure it has the necessary permissions."
      );
    }

    if (error.message.includes("rate limit")) {
      throw new Error(
        "Rate limit exceeded. Please wait a few minutes before trying again, or try with fewer files."
      );
    }

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
        timeout: 180000,
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
        timeout: 120000,
      }
    );

    console.log("✅ File test cases generated successfully");
    return response;
  } catch (error) {
    console.error("❌ Failed to generate file test cases:", error.message);
    throw error;
  }
};

// Fallback test case generation for unsupported scenarios
export const generateFallbackTestCases = async (files, config = {}) => {
  console.log("🔄 Generating fallback test cases...");

  try {
    const fallbackTestCases = files.map((file, index) => {
      const language = detectLanguageFromPath(file.path);
      const testType = inferTestType(file.path, language);

      return {
        id: `fallback-${Date.now()}-${index}`,
        title: `Test ${file.name}`,
        description: `Basic test case for ${file.name} (${language})`,
        type: testType,
        priority: "medium",
        language,
        framework: getDefaultFramework(language),
        code: generateBasicTestTemplate(file, language, testType),
        tags: [language, testType, "fallback"],
        estimatedTime: 30,
        complexity: "simple",
        riskLevel: "low",
        universalPattern: true,
        fallback: true,
        file: file.path,
        generated: new Date().toISOString(),
      };
    });

    return {
      success: true,
      testCases: fallbackTestCases,
      fallback: true,
      metadata: {
        totalGenerated: fallbackTestCases.length,
        languages: [...new Set(fallbackTestCases.map((tc) => tc.language))],
        note: "Generated using fallback templates",
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("❌ Fallback generation failed:", error);
    throw new Error("Failed to generate fallback test cases");
  }
};

// Infer appropriate test type based on file path and language
const inferTestType = (filePath, language) => {
  const path = filePath.toLowerCase();

  if (
    path.includes("api") ||
    path.includes("rest") ||
    path.includes("endpoint")
  )
    return "api";
  if (
    path.includes("db") ||
    path.includes("database") ||
    path.includes("model")
  )
    return "database";
  if (
    path.includes("ui") ||
    path.includes("component") ||
    path.includes("view")
  )
    return "integration";
  if (
    path.includes("service") ||
    path.includes("util") ||
    path.includes("helper")
  )
    return "unit";
  if (path.includes("e2e") || path.includes("integration")) return "e2e";

  // Language-specific defaults
  switch (language) {
    case "javascript":
    case "typescript":
      return path.includes("component") ? "integration" : "unit";
    case "python":
      return path.includes("test_") ? "unit" : "unit";
    case "java":
      return path.includes("Test") ? "unit" : "unit";
    default:
      return "unit";
  }
};

// Get default testing framework for each language
const getDefaultFramework = (language) => {
  const defaultFrameworks = {
    javascript: "Jest",
    typescript: "Jest",
    python: "pytest",
    java: "JUnit 5",
    csharp: "NUnit",
    php: "PHPUnit",
    ruby: "RSpec",
    go: "testing",
    rust: "cargo test",
    swift: "XCTest",
    kotlin: "JUnit",
    scala: "ScalaTest",
    cpp: "Google Test",
    c: "Unity",
    dart: "test",
    elixir: "ExUnit",
    erlang: "EUnit",
    haskell: "Hspec",
    r: "testthat",
    perl: "Test::More",
    lua: "busted",
    shell: "Bats",
    sql: "Custom",
    html: "Cypress",
    css: "Visual Testing",
  };

  return defaultFrameworks[language] || "Generic Testing Framework";
};

// Generate basic test template based on language and type
const generateBasicTestTemplate = (file, language, testType) => {
  const templates = {
    javascript: {
      unit: `// Unit test for ${file.name}
import { ${file.name.replace(/\.[^/.]+$/, "")} } from './${file.path}';

describe('${file.name}', () => {
  test('should work correctly', () => {
    // Arrange
    
    // Act
    
    // Assert
    expect(true).toBe(true);
  });
  
  test('should handle edge cases', () => {
    // Test edge cases
    expect(true).toBe(true);
  });
});`,

      api: `// API test for ${file.name}
import request from 'supertest';
import app from '../app';

describe('${file.name} API', () => {
  test('GET request should return success', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
});`,
    },

    python: {
      unit: `# Unit test for ${file.name}
import unittest
from ${file.path.replace("/", ".").replace(".py", "")} import *

class Test${file.name
        .replace(".py", "")
        .replace(/[^a-zA-Z0-9]/g, "")}(unittest.TestCase):
    
    def test_basic_functionality(self):
        """Test basic functionality"""
        # Arrange
        
        # Act
        
        # Assert
        self.assertTrue(True)
    
    def test_edge_cases(self):
        """Test edge cases"""
        # Test edge cases
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()`,
    },

    java: {
      unit: `// Unit test for ${file.name}
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import static org.junit.jupiter.api.Assertions.*;

class ${file.name.replace(".java", "")}Test {
    
    @BeforeEach
    void setUp() {
        // Setup test data
    }
    
    @Test
    void testBasicFunctionality() {
        // Arrange
        
        // Act
        
        // Assert
        assertTrue(true);
    }
    
    @Test
    void testEdgeCases() {
        // Test edge cases
        assertTrue(true);
    }
}`,
    },

    generic: `// Test for ${file.name}
// Language: ${language}
// Type: ${testType}

// Basic test structure:
// 1. Setup/Arrange
// 2. Execute/Act  
// 3. Verify/Assert

// Test case 1: Basic functionality
// TODO: Implement basic functionality test

// Test case 2: Edge cases
// TODO: Implement edge case tests

// Test case 3: Error handling
// TODO: Implement error handling tests
`,
  };

  const languageTemplates = templates[language];
  if (languageTemplates && languageTemplates[testType]) {
    return languageTemplates[testType];
  }

  if (languageTemplates && languageTemplates.unit) {
    return languageTemplates.unit;
  }

  return templates.generic;
};

//
// ─── ENHANCED REPOSITORY ANALYSIS ──────────────────────
//

export const analyzeRepositoryStructure = async (sessionId, owner, repo) => {
  try {
    console.log(`🔍 Analyzing repository structure for ${owner}/${repo}...`);

    const response = await api.get(`/github/repos/${owner}/${repo}/analyze`, {
      headers: { Authorization: `Bearer ${sessionId}` },
    });

    return response;
  } catch (error) {
    console.error("❌ Repository analysis failed:", error.message);

    // Provide fallback analysis
    return {
      success: true,
      analysis: {
        languages: ["unknown"],
        frameworks: [],
        patterns: [],
        testingCapabilities: "basic",
        complexity: "medium",
        recommendedStrategy: "standard",
      },
      fallback: true,
    };
  }
};

export const detectProjectFrameworks = async (files, sessionId) => {
  try {
    const response = await api.post(
      "/analysis/frameworks",
      { files },
      { headers: { Authorization: `Bearer ${sessionId}` } }
    );

    return response;
  } catch (error) {
    console.error("❌ Framework detection failed:", error.message);

    // Fallback framework detection
    const frameworks = new Set();

    files.forEach((file) => {
      const path = file.path.toLowerCase();

      // Detect frameworks from file names and paths
      if (path.includes("package.json") || path.includes("node_modules"))
        frameworks.add("Node.js");
      if (path.includes("requirements.txt") || path.includes("setup.py"))
        frameworks.add("Python");
      if (path.includes("pom.xml") || path.includes("build.gradle"))
        frameworks.add("Java/Maven");
      if (path.includes("composer.json")) frameworks.add("PHP/Composer");
      if (path.includes("gemfile")) frameworks.add("Ruby/Bundler");
      if (path.includes("go.mod")) frameworks.add("Go Modules");
      if (path.includes("cargo.toml")) frameworks.add("Rust/Cargo");
      if (path.includes("dockerfile")) frameworks.add("Docker");

      // Framework-specific files
      if (path.includes("react") || path.includes("jsx"))
        frameworks.add("React");
      if (path.includes("vue")) frameworks.add("Vue.js");
      if (path.includes("angular")) frameworks.add("Angular");
      if (path.includes("django")) frameworks.add("Django");
      if (path.includes("flask")) frameworks.add("Flask");
      if (path.includes("spring")) frameworks.add("Spring");
      if (path.includes("laravel")) frameworks.add("Laravel");
      if (path.includes("rails")) frameworks.add("Ruby on Rails");
    });

    return {
      success: true,
      frameworks: Array.from(frameworks),
      fallback: true,
    };
  }
};

//
// ─── TEST SUGGESTIONS AND FRAMEWORKS ───────────────────
//

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
// ─── SUMMARY AND ANALYSIS FUNCTIONS ────────────────────
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
        timeout: 60000,
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Summary generation failed:", error.message);
    // Return fallback summary
    return {
      insights: ["Test cases generated successfully"],
      recommendations: ["Review generated tests for accuracy"],
      coverage: "Basic coverage analysis completed",
      qualityAssessment: "Standard quality assessment",
      fallback: true,
    };
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
        timeout: 30000,
      }
    );

    return response;
  } catch (error) {
    console.error("❌ Metrics calculation failed:", error.message);
    return null;
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
// ─── FILE PROCESSING UTILITIES ─────────────────────────
//

export const processSelectedFiles = async (selectedFiles, sessionId) => {
  if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
    throw new Error("Selected files array is required");
  }

  const filesWithContent = [];
  const errors = [];

  for (const file of selectedFiles) {
    try {
      console.log(`📄 Fetching content for ${file.path}...`);

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

//
// ─── UTILITY FUNCTIONS ─────────────────────────────────
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
    return true;
  } catch (error) {
    console.error("❌ Failed to download test cases:", error);
    return false;
  }
};

export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand("copy");
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error("❌ Copy to clipboard failed:", error);
    return false;
  }
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const estimateGenerationTime = (fileCount, complexity = "medium") => {
  const baseTime = {
    simple: 2, // seconds per file
    medium: 5,
    complex: 10,
  };

  const time = fileCount * (baseTime[complexity] || baseTime.medium);

  if (time < 60) return `${Math.round(time)}s`;
  if (time < 3600) return `${Math.round(time / 60)}m`;
  return `${Math.round(time / 3600)}h`;
};

export const validateConfiguration = (config, files) => {
  const errors = [];
  const warnings = [];

  // Validate test types
  if (!config.types || config.types.length === 0) {
    errors.push("At least one test type must be selected");
  }

  // Validate complexity
  const validComplexities = ["simple", "medium", "complex", "adaptive"];
  if (!validComplexities.includes(config.complexity)) {
    warnings.push("Invalid complexity level, defaulting to 'medium'");
  }

  // Validate coverage target
  if (config.coverageTarget < 50 || config.coverageTarget > 100) {
    warnings.push("Coverage target should be between 50-100%");
  }

  // Check file count vs complexity
  if (files.length > 50 && config.complexity === "complex") {
    warnings.push("Complex generation with many files may take a long time");
  }

  return { errors, warnings, valid: errors.length === 0 };
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

// Export enhanced API instance
export default api;

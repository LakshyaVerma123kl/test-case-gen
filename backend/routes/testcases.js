const express = require('express');
const { validateSession, githubClients } = require('./auth');
const geminiService = require('../services/geminiService');
const FileAnalysisService = require('../services/fileAnalysis');
const router = express.Router();

// Initialize services
const fileAnalysisService = new FileAnalysisService();

// Apply session validation to all routes
router.use(validateSession);

// Helper function to get GitHub client
const getGitHubClient = (sessionId) => {
  const client = githubClients.get(sessionId);
  if (!client) {
    throw new Error('GitHub client not found for session');
  }
  return client;
};

// Generate test case summaries (for frontend compatibility)
router.post('/generate-summaries', async (req, res) => {
  try {
    const { files, language = 'auto', testFramework = 'auto' } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: 'Files array is required and cannot be empty',
      });
    }

    // Validate files structure
    const invalidFiles = files.filter((file) => !file.path || !file.content);
    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'All files must have path and content properties',
      });
    }

    // Generate test cases using Gemini
    const testCases = await geminiService.generateTestCases(files, {
      types: ['unit'],
      complexity: 'medium',
      framework: testFramework,
    });

    // Generate summary
    const summary = await geminiService.generateSummary(testCases, {
      repository: files[0]?.repository || 'Unknown',
      files: files.length,
      language,
      testFramework,
    });

    res.json({
      success: true,
      testCases,
      summary,
      metadata: {
        filesAnalyzed: files.length,
        language,
        testFramework,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating test case summaries:', error);
    res.status(500).json({
      error: 'Failed to generate test case summaries',
      message: error.message,
    });
  }
});

// Generate test cases for specific files
router.post('/generate', async (req, res) => {
  try {
    const { files, config = {} } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: 'Files array is required and cannot be empty',
      });
    }

    // Validate files array
    const invalidFiles = files.filter((file) => !file.path || !file.content);
    if (invalidFiles.length > 0) {
      return res.status(400).json({
        error: 'All files must have path and content properties',
      });
    }

    // Set default config
    const testConfig = {
      types: config.types || ['unit'],
      complexity: config.complexity || 'medium',
      framework: config.framework || 'auto',
      ...config,
    };

    // Generate test cases using Gemini
    const testCases = await geminiService.generateTestCases(files, testConfig);

    res.json({
      success: true,
      testCases,
      metadata: {
        filesAnalyzed: files.length,
        ...testConfig,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating test cases:', error);
    res.status(500).json({
      error: 'Failed to generate test cases',
      message: error.message,
    });
  }
});

// Generate test cases for entire repository
router.post('/generate/repository', async (req, res) => {
  try {
    const {
      owner,
      repo,
      branch = 'main',
      maxFiles = 10,
      testType = 'unit',
      framework,
      options = {},
    } = req.body;

    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Repository owner and name are required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);

    // Get repository tree
    const tree = await githubService.getRepositoryTree(owner, repo, branch, true);

    const files = tree.tree
      .filter((item) => item.type === 'blob')
      .map((item) => ({
        path: item.path,
        name: item.path.split('/').pop(),
        size: item.size,
        sha: item.sha,
      }));

    // Select best files for test generation
    const analysisResult = fileAnalysisService.selectFilesForTestGeneration(files, maxFiles);

    // Get content for selected files
    const fileContents = await Promise.all(
      analysisResult.selectedFiles.slice(0, maxFiles).map(async (file) => {
        try {
          const content = await githubService.getFileContent(owner, repo, file.path);
          return {
            path: file.path,
            name: file.name,
            content: content.decodedContent,
            type: file.type,
            category: file.category,
            priority: file.priority,
            size: content.size,
          };
        } catch (error) {
          console.error(`Error fetching content for ${file.path}:`, error);
          return null;
        }
      })
    );

    // Filter out failed requests and large files
    const validFileContents = fileContents.filter(Boolean).filter((file) => file.size < 100000); // Skip files larger than 100KB

    if (validFileContents.length === 0) {
      return res.status(400).json({
        error: 'No suitable files found for test generation',
      });
    }

    // Generate test cases
    const testCases = await geminiService.generateTestCases(validFileContents, {
      types: [testType],
      framework: framework || analysisResult.testStrategy.testFramework,
      projectStructure: analysisResult.projectStructure,
      testStrategy: analysisResult.testStrategy,
      ...options,
    });

    res.json({
      success: true,
      repository: { owner, repo, branch },
      analysis: {
        totalFiles: files.length,
        selectedFiles: analysisResult.selectedFiles.length,
        analyzedFiles: validFileContents.length,
        projectStructure: analysisResult.projectStructure,
        testStrategy: analysisResult.testStrategy,
      },
      testCases,
      metadata: {
        testType,
        framework: framework || analysisResult.testStrategy.testFramework,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating repository test cases:', error);
    res.status(500).json({
      error: 'Failed to generate repository test cases',
      message: error.message,
    });
  }
});

// Generate test cases for specific file
router.post('/generate/file', async (req, res) => {
  try {
    const { owner, repo, path, testType = 'unit', framework, options = {} } = req.body;

    if (!owner || !repo || !path) {
      return res.status(400).json({
        error: 'Repository owner, name, and file path are required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);

    // Get file content
    const fileData = await githubService.getFileContent(owner, repo, path);

    // Analyze file
    const fileAnalysis = fileAnalysisService.analyzeFile(fileData);

    if (!fileAnalysis.shouldAnalyze) {
      return res.status(400).json({
        error: 'File type not suitable for test generation',
        reason: fileAnalysis.reason,
      });
    }

    // Get repository structure for context
    const repoData = await githubService.getRepository(owner, repo);
    const languages = await githubService.getRepositoryLanguages(owner, repo);

    const file = {
      path: fileData.path,
      name: fileData.name,
      content: fileData.decodedContent,
      type: fileAnalysis.type,
      category: fileAnalysis.category,
      size: fileData.size,
    };

    // Generate test cases
    const testCases = await geminiService.generateTestCases([file], {
      types: [testType],
      framework,
      repository: {
        owner,
        repo,
        description: repoData.description,
        language: repoData.language,
        languages,
      },
      ...options,
    });

    res.json({
      success: true,
      repository: { owner, repo },
      file: {
        path: file.path,
        name: file.name,
        type: file.type,
        category: file.category,
        size: file.size,
      },
      testCases,
      metadata: {
        testType,
        framework,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating file test cases:', error);
    res.status(500).json({
      error: 'Failed to generate file test cases',
      message: error.message,
    });
  }
});

// Generate summary for test cases
router.post('/summary', async (req, res) => {
  try {
    const { testCases, metadata = {} } = req.body;

    if (!testCases || !Array.isArray(testCases)) {
      return res.status(400).json({
        error: 'Test cases array is required',
      });
    }

    const summary = await geminiService.generateSummary(testCases, metadata);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error generating summary:', error);
    res.status(500).json({
      error: 'Failed to generate summary',
      message: error.message,
    });
  }
});

// Get test case metrics
router.post('/metrics', async (req, res) => {
  try {
    const { testCases } = req.body;

    if (!testCases || !Array.isArray(testCases)) {
      return res.status(400).json({
        error: 'Test cases array is required',
      });
    }

    // Calculate basic metrics
    const metrics = {
      total: testCases.length,
      byType: {},
      byPriority: {},
      byFile: {},
      complexity: {
        low: 0,
        medium: 0,
        high: 0,
      },
      estimatedExecutionTime: testCases.length * 2, // 2 minutes per test case
    };

    testCases.forEach((tc) => {
      // Count by type
      metrics.byType[tc.type] = (metrics.byType[tc.type] || 0) + 1;

      // Count by priority
      metrics.byPriority[tc.priority] = (metrics.byPriority[tc.priority] || 0) + 1;

      // Count by file
      metrics.byFile[tc.file] = (metrics.byFile[tc.file] || 0) + 1;

      // Estimate complexity based on code length
      const codeLength = tc.code?.length || 0;
      if (codeLength < 200) {
        metrics.complexity.low++;
      } else if (codeLength < 500) {
        metrics.complexity.medium++;
      } else {
        metrics.complexity.high++;
      }
    });

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error calculating metrics:', error);
    res.status(500).json({
      error: 'Failed to calculate metrics',
      message: error.message,
    });
  }
});

// Generate test code (for compatibility)
router.post('/generate-code', async (req, res) => {
  try {
    const fileData = req.body;

    if (!fileData || !fileData.content) {
      return res.status(400).json({
        error: 'File data with content is required',
      });
    }

    // Convert single file to array format for consistency
    const files = Array.isArray(fileData) ? fileData : [fileData];

    const testCases = await geminiService.generateTestCases(files, {
      types: ['unit'],
      complexity: 'medium',
    });

    res.json({
      success: true,
      testCases,
    });
  } catch (error) {
    console.error('Error generating test code:', error);
    res.status(500).json({
      error: 'Failed to generate test code',
      message: error.message,
    });
  }
});

// Recommend test framework
router.post('/recommend-framework', async (req, res) => {
  try {
    const { files } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        error: 'Files array is required',
      });
    }

    // Analyze files to recommend framework
    const analysis = fileAnalysisService.analyzeRepositoryStructure(files);
    const testStrategy = fileAnalysisService.getTestGenerationStrategy(analysis.projectStructure);

    res.json({
      success: true,
      recommendation: {
        framework: testStrategy.testFramework,
        language: analysis.projectStructure.language,
        projectType: analysis.projectStructure.type,
        testDirectory: testStrategy.testDirectory,
        testFilePattern: testStrategy.testFilePattern,
        mockingLibrary: testStrategy.mockingLibrary,
      },
      analysis: {
        ...analysis,
        languages: Array.from(analysis.languages),
      },
    });
  } catch (error) {
    console.error('Error recommending framework:', error);
    res.status(500).json({
      error: 'Failed to recommend test framework',
      message: error.message,
    });
  }
});

// Get test frameworks and configurations
router.get('/frameworks', (req, res) => {
  const frameworks = {
    javascript: [
      { name: 'jest', description: 'Delightful JavaScript Testing Framework', popular: true },
      { name: 'mocha', description: 'Feature-rich JavaScript test framework', popular: true },
      { name: 'jasmine', description: 'Behavior-driven development framework', popular: false },
      { name: 'cypress', description: 'End-to-end testing framework', popular: true },
      { name: 'playwright', description: 'Cross-browser end-to-end testing', popular: true },
    ],
    typescript: [
      { name: 'jest', description: 'With TypeScript support', popular: true },
      { name: 'vitest', description: 'Vite-native unit test framework', popular: true },
      { name: 'cypress', description: 'TypeScript-first E2E testing', popular: true },
    ],
    python: [
      { name: 'pytest', description: 'The pytest framework', popular: true },
      { name: 'unittest', description: 'Python built-in testing framework', popular: true },
      { name: 'nose2', description: 'Successor to nose testing framework', popular: false },
    ],
    java: [
      { name: 'junit', description: 'Most popular Java testing framework', popular: true },
      { name: 'testng', description: 'Testing framework inspired by JUnit', popular: true },
      { name: 'mockito', description: 'Mocking framework for unit tests', popular: true },
    ],
    go: [
      { name: 'testing', description: 'Go built-in testing package', popular: true },
      { name: 'testify', description: 'Toolkit with common assertions', popular: true },
      { name: 'ginkgo', description: 'BDD testing framework', popular: false },
    ],
    rust: [
      { name: 'built-in', description: 'Rust built-in test framework', popular: true },
      { name: 'criterion', description: 'Statistics-driven benchmarking', popular: true },
    ],
    csharp: [
      { name: 'nunit', description: 'Unit-testing framework for .NET', popular: true },
      { name: 'xunit', description: 'Free, open source testing tool', popular: true },
      { name: 'mstest', description: 'Microsoft testing framework', popular: true },
    ],
  };

  res.json({ frameworks });
});

// Get test types and their descriptions
router.get('/types', (req, res) => {
  const testTypes = {
    unit: {
      name: 'Unit Tests',
      description: 'Test individual components or functions in isolation',
      scope: 'Small',
      speed: 'Fast',
      examples: ['Function testing', 'Class method testing', 'Component testing'],
    },
    integration: {
      name: 'Integration Tests',
      description: 'Test the interaction between integrated components',
      scope: 'Medium',
      speed: 'Medium',
      examples: ['API integration', 'Database integration', 'Service integration'],
    },
    e2e: {
      name: 'End-to-End Tests',
      description: 'Test complete user workflows from start to finish',
      scope: 'Large',
      speed: 'Slow',
      examples: ['User journey testing', 'Browser automation', 'Full stack testing'],
    },
    performance: {
      name: 'Performance Tests',
      description: 'Test system performance under various conditions',
      scope: 'Variable',
      speed: 'Variable',
      examples: ['Load testing', 'Stress testing', 'Benchmark testing'],
    },
    security: {
      name: 'Security Tests',
      description: 'Test for security vulnerabilities and threats',
      scope: 'Variable',
      speed: 'Variable',
      examples: ['Input validation', 'Authentication testing', 'Authorization testing'],
    },
  };

  res.json({ testTypes });
});

module.exports = router;

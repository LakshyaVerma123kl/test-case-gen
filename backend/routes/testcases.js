const express = require('express');
const { validateSession, githubClients } = require('./auth');
const geminiService = require('../services/geminiService'); // Fix: Properly import geminiService
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

// Generate test cases for specific files
router.post('/generate', async (req, res) => {
  try {
    const { repository, files, testType = 'unit', framework, options = {} } = req.body;

    if (!repository || !files || files.length === 0) {
      return res.status(400).json({
        error: 'Repository and files are required',
      });
    }

    // Validate files array
    if (!Array.isArray(files) || files.some((file) => !file.path || !file.content)) {
      return res.status(400).json({
        error: 'Files must be an array with path and content for each file',
      });
    }

    // Generate test cases using Gemini
    const testCases = await geminiService.generateTestCases(files, {
      repository,
      testType,
      framework,
      options,
    });

    res.json({
      success: true,
      repository,
      testCases,
      metadata: {
        filesAnalyzed: files.length,
        testType,
        framework,
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
      repository: { owner, repo, branch },
      testType,
      framework: framework || analysisResult.testStrategy.testFramework,
      projectStructure: analysisResult.projectStructure,
      testStrategy: analysisResult.testStrategy,
      options,
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
      repository: {
        owner,
        repo,
        description: repoData.description,
        language: repoData.language,
        languages,
      },
      testType,
      framework,
      options,
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

// Get test generation suggestions
router.post('/suggestions', async (req, res) => {
  try {
    const { files, projectStructure } = req.body;

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        error: 'Files array is required',
      });
    }

    // Analyze files and get suggestions
    const analysis = fileAnalysisService.analyzeRepositoryStructure(files);
    const testStrategy = fileAnalysisService.getTestGenerationStrategy(
      projectStructure || analysis.projectStructure
    );

    // Get AI suggestions for test improvement
    const suggestions = await geminiService.generateSummary([], {
      projectStructure: analysis.projectStructure,
      testStrategy,
      existingTests: analysis.testFiles,
      sourceFiles: analysis.sourceFiles,
    });

    res.json({
      success: true,
      analysis: {
        ...analysis,
        languages: Array.from(analysis.languages),
      },
      testStrategy,
      suggestions,
      recommendations: {
        priority: 'high',
        actions: [
          `Set up ${testStrategy.testFramework} testing framework`,
          `Create ${testStrategy.testDirectory} directory`,
          `Follow ${testStrategy.testFilePattern} naming convention`,
          `Use ${testStrategy.mockingLibrary} for mocking`,
        ],
      },
    });
  } catch (error) {
    console.error('Error getting test suggestions:', error);
    res.status(500).json({
      error: 'Failed to get test suggestions',
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

const path = require('path');

class FileAnalysisService {
  constructor() {
    // Supported file extensions and their analysis priority
    this.supportedExtensions = {
      // High priority - main code files
      '.js': { type: 'javascript', priority: 1, category: 'source' },
      '.jsx': { type: 'javascript', priority: 1, category: 'source' },
      '.ts': { type: 'typescript', priority: 1, category: 'source' },
      '.tsx': { type: 'typescript', priority: 1, category: 'source' },
      '.py': { type: 'python', priority: 1, category: 'source' },
      '.java': { type: 'java', priority: 1, category: 'source' },
      '.cpp': { type: 'cpp', priority: 1, category: 'source' },
      '.c': { type: 'c', priority: 1, category: 'source' },
      '.cs': { type: 'csharp', priority: 1, category: 'source' },
      '.php': { type: 'php', priority: 1, category: 'source' },
      '.rb': { type: 'ruby', priority: 1, category: 'source' },
      '.go': { type: 'go', priority: 1, category: 'source' },
      '.rs': { type: 'rust', priority: 1, category: 'source' },
      '.swift': { type: 'swift', priority: 1, category: 'source' },
      '.kt': { type: 'kotlin', priority: 1, category: 'source' },
      '.scala': { type: 'scala', priority: 1, category: 'source' },

      // Medium priority - test files
      '.test.js': { type: 'javascript', priority: 2, category: 'test' },
      '.spec.js': { type: 'javascript', priority: 2, category: 'test' },
      '.test.ts': { type: 'typescript', priority: 2, category: 'test' },
      '.spec.ts': { type: 'typescript', priority: 2, category: 'test' },
      '.test.py': { type: 'python', priority: 2, category: 'test' },

      // Medium priority - config files
      '.json': { type: 'json', priority: 3, category: 'config' },
      '.yml': { type: 'yaml', priority: 3, category: 'config' },
      '.yaml': { type: 'yaml', priority: 3, category: 'config' },
      '.xml': { type: 'xml', priority: 3, category: 'config' },
      '.toml': { type: 'toml', priority: 3, category: 'config' },

      // Low priority - documentation
      '.md': { type: 'markdown', priority: 4, category: 'docs' },
      '.txt': { type: 'text', priority: 4, category: 'docs' },
      '.rst': { type: 'restructuredtext', priority: 4, category: 'docs' },

      // Low priority - web files
      '.html': { type: 'html', priority: 4, category: 'web' },
      '.css': { type: 'css', priority: 4, category: 'web' },
      '.scss': { type: 'scss', priority: 4, category: 'web' },
      '.less': { type: 'less', priority: 4, category: 'web' },
      '.vue': { type: 'vue', priority: 2, category: 'source' },
      '.svelte': { type: 'svelte', priority: 2, category: 'source' },
    };

    // Files to ignore
    this.ignoredPaths = [
      'node_modules',
      '.git',
      '.vscode',
      '.idea',
      'dist',
      'build',
      'target',
      '__pycache__',
      '.pytest_cache',
      'coverage',
      '.nyc_output',
      'logs',
      '*.log',
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      'package-lock.json',
      'yarn.lock',
      'Pipfile.lock',
      '.DS_Store',
      'Thumbs.db',
    ];

    // Important config files that should always be analyzed
    this.importantConfigFiles = [
      'package.json',
      'requirements.txt',
      'Pipfile',
      'pom.xml',
      'build.gradle',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'Gemfile',
      'tsconfig.json',
      'jest.config.js',
      'webpack.config.js',
      'babel.config.js',
      'eslint.config.js',
      '.eslintrc',
      'prettier.config.js',
      '.prettierrc',
      'docker-compose.yml',
      'Dockerfile',
      'Makefile',
    ];
  }

  // Analyze repository structure
  analyzeRepositoryStructure(files) {
    const analysis = {
      totalFiles: files.length,
      filesByType: {},
      filesByCategory: {},
      languages: new Set(),
      hasTests: false,
      testFiles: [],
      configFiles: [],
      sourceFiles: [],
      documentationFiles: [],
      recommendedFilesForAnalysis: [],
      projectStructure: {
        type: 'unknown',
        framework: null,
        buildTool: null,
        testFramework: null,
      },
    };

    // Analyze each file
    files.forEach((file) => {
      const fileInfo = this.analyzeFile(file);

      if (fileInfo.shouldAnalyze) {
        analysis.recommendedFilesForAnalysis.push({
          ...file,
          ...fileInfo,
        });
      }

      // Update counters
      if (fileInfo.type) {
        analysis.filesByType[fileInfo.type] = (analysis.filesByType[fileInfo.type] || 0) + 1;
        analysis.languages.add(fileInfo.type);
      }

      if (fileInfo.category) {
        analysis.filesByCategory[fileInfo.category] =
          (analysis.filesByCategory[fileInfo.category] || 0) + 1;

        // Categorize files
        switch (fileInfo.category) {
          case 'test':
            analysis.hasTests = true;
            analysis.testFiles.push(file);
            break;
          case 'config':
            analysis.configFiles.push(file);
            break;
          case 'source':
            analysis.sourceFiles.push(file);
            break;
          case 'docs':
            analysis.documentationFiles.push(file);
            break;
        }
      }
    });

    // Convert languages set to array
    analysis.languages = Array.from(analysis.languages);

    // Detect project type and framework
    analysis.projectStructure = this.detectProjectStructure(files);

    // Sort recommended files by priority
    analysis.recommendedFilesForAnalysis.sort((a, b) => a.priority - b.priority);

    return analysis;
  }

  // Analyze individual file
  analyzeFile(file) {
    // ✅ FIX: Handle cases where file.name might not exist
    const fileName = file.name || (file.path ? path.basename(file.path) : 'unknown');
    const filePath = file.path || '';
    const extension = this.getFileExtension(fileName);

    // Check if file should be ignored
    if (this.shouldIgnoreFile(filePath, fileName)) {
      return {
        shouldAnalyze: false,
        ignored: true,
        reason: 'File type or path is ignored',
      };
    }

    // Check if it's an important config file
    if (this.importantConfigFiles.includes(fileName)) {
      return {
        shouldAnalyze: true,
        type: 'config',
        category: 'config',
        priority: 2,
        importance: 'high',
        reason: 'Important configuration file',
      };
    }

    // Check supported extensions
    const fileConfig = this.supportedExtensions[extension];
    if (fileConfig) {
      return {
        shouldAnalyze: true,
        type: fileConfig.type,
        category: fileConfig.category,
        priority: fileConfig.priority,
        importance: fileConfig.priority <= 2 ? 'high' : 'medium',
        reason: `Supported ${fileConfig.category} file`,
      };
    }

    // Default: don't analyze
    return {
      shouldAnalyze: false,
      type: 'unknown',
      reason: 'Unsupported file type',
    };
  }

  // Get file extension (handles special cases like .test.js)
  getFileExtension(fileName) {
    // ✅ FIX: Add safety check
    if (!fileName) return '';

    // Handle special test file extensions
    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      const parts = fileName.split('.');
      if (parts.length >= 3) {
        return `.${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      }
    }

    return path.extname(fileName);
  }

  // Check if file should be ignored
  shouldIgnoreFile(filePath, fileName) {
    // ✅ FIX: Add safety checks
    if (!fileName && !filePath) return true;

    const safeFileName = fileName || '';
    const safeFilePath = filePath || '';

    // Check ignored paths
    for (const ignoredPath of this.ignoredPaths) {
      if (ignoredPath.includes('*')) {
        // Handle wildcards
        const pattern = new RegExp(ignoredPath.replace(/\*/g, '.*'));
        if (pattern.test(safeFileName) || pattern.test(safeFilePath)) {
          return true;
        }
      } else {
        if (safeFilePath.includes(ignoredPath) || safeFileName === ignoredPath) {
          return true;
        }
      }
    }

    return false;
  }

  // Detect project structure and framework
  detectProjectStructure(files) {
    const structure = {
      type: 'unknown',
      framework: null,
      buildTool: null,
      testFramework: null,
      language: null,
    };

    // ✅ FIX: Add safety checks for file properties
    const fileNames = files
      .map((f) => {
        if (f.name) return f.name;
        if (f.path) return path.basename(f.path);
        return '';
      })
      .filter(Boolean);

    const filePaths = files.map((f) => f.path || '').filter(Boolean);

    // Detect by package.json
    if (fileNames.includes('package.json')) {
      structure.type = 'javascript';
      structure.buildTool = 'npm';

      // Try to detect framework from common file patterns
      if (filePaths.some((p) => p.includes('src/App.js') || p.includes('src/App.tsx'))) {
        structure.framework = 'react';
      } else if (filePaths.some((p) => p.includes('pages/') && p.includes('_app.'))) {
        structure.framework = 'nextjs';
      } else if (filePaths.some((p) => p.includes('nuxt.config'))) {
        structure.framework = 'nuxtjs';
      } else if (filePaths.some((p) => p.includes('angular.json'))) {
        structure.framework = 'angular';
      } else if (filePaths.some((p) => p.includes('svelte.config'))) {
        structure.framework = 'svelte';
      }
    }

    // Detect Python
    else if (
      fileNames.includes('requirements.txt') ||
      fileNames.includes('Pipfile') ||
      fileNames.includes('pyproject.toml')
    ) {
      structure.type = 'python';
      structure.language = 'python';

      if (fileNames.includes('manage.py')) {
        structure.framework = 'django';
      } else if (filePaths.some((p) => p.includes('app.py') || p.includes('flask'))) {
        structure.framework = 'flask';
      } else if (filePaths.some((p) => p.includes('fastapi') || p.includes('main.py'))) {
        structure.framework = 'fastapi';
      }
    }

    // Detect Java
    else if (fileNames.includes('pom.xml')) {
      structure.type = 'java';
      structure.language = 'java';
      structure.buildTool = 'maven';

      if (filePaths.some((p) => p.includes('spring'))) {
        structure.framework = 'spring';
      }
    } else if (fileNames.includes('build.gradle')) {
      structure.type = 'java';
      structure.language = 'java';
      structure.buildTool = 'gradle';
    }

    // Detect Go
    else if (fileNames.includes('go.mod')) {
      structure.type = 'go';
      structure.language = 'go';
      structure.buildTool = 'go';
    }

    // Detect Rust
    else if (fileNames.includes('Cargo.toml')) {
      structure.type = 'rust';
      structure.language = 'rust';
      structure.buildTool = 'cargo';
    }

    // Detect C#
    else if (fileNames.some((f) => f.endsWith('.csproj') || f.endsWith('.sln'))) {
      structure.type = 'csharp';
      structure.language = 'csharp';
      structure.buildTool = 'dotnet';
    }

    // Detect test frameworks
    if (fileNames.includes('jest.config.js') || filePaths.some((p) => p.includes('jest'))) {
      structure.testFramework = 'jest';
    } else if (fileNames.includes('cypress.json') || filePaths.some((p) => p.includes('cypress'))) {
      structure.testFramework = 'cypress';
    } else if (filePaths.some((p) => p.includes('pytest') || p.includes('test_'))) {
      structure.testFramework = 'pytest';
    } else if (filePaths.some((p) => p.includes('unittest'))) {
      structure.testFramework = 'unittest';
    }

    return structure;
  }

  // Get test generation strategy based on project structure
  getTestGenerationStrategy(projectStructure) {
    const strategies = {
      javascript: {
        testFramework: projectStructure.testFramework || 'jest',
        testFilePattern: '{filename}.test.js',
        testDirectory: '__tests__',
        mockingLibrary: projectStructure.framework === 'react' ? '@testing-library/react' : 'jest',
      },
      typescript: {
        testFramework: projectStructure.testFramework || 'jest',
        testFilePattern: '{filename}.test.ts',
        testDirectory: '__tests__',
        mockingLibrary: projectStructure.framework === 'react' ? '@testing-library/react' : 'jest',
      },
      python: {
        testFramework: projectStructure.testFramework || 'pytest',
        testFilePattern: 'test_{filename}.py',
        testDirectory: 'tests',
        mockingLibrary: 'unittest.mock',
      },
      java: {
        testFramework: 'junit',
        testFilePattern: '{Filename}Test.java',
        testDirectory: 'src/test/java',
        mockingLibrary: 'mockito',
      },
      go: {
        testFramework: 'go test',
        testFilePattern: '{filename}_test.go',
        testDirectory: '.',
        mockingLibrary: 'testify',
      },
      rust: {
        testFramework: 'cargo test',
        testFilePattern: '{filename}_test.rs',
        testDirectory: 'tests',
        mockingLibrary: 'mockall',
      },
    };

    return strategies[projectStructure.type] || strategies.javascript;
  }

  // Filter files for test generation
  selectFilesForTestGeneration(files, maxFiles = 10) {
    const analysis = this.analyzeRepositoryStructure(files);

    // Prioritize source files, then important config files
    let selectedFiles = analysis.recommendedFilesForAnalysis
      .filter(
        (file) =>
          file.category === 'source' || (file.category === 'config' && file.importance === 'high')
      )
      .slice(0, maxFiles);

    // If we don't have enough files, add some test files for reference
    if (selectedFiles.length < maxFiles && analysis.testFiles.length > 0) {
      const remainingSlots = maxFiles - selectedFiles.length;
      selectedFiles = selectedFiles.concat(analysis.testFiles.slice(0, remainingSlots));
    }

    return {
      selectedFiles,
      totalAnalyzed: selectedFiles.length,
      projectStructure: analysis.projectStructure,
      testStrategy: this.getTestGenerationStrategy(analysis.projectStructure),
    };
  }
}

module.exports = FileAnalysisService;

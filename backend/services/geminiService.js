const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });
  }

  /**
   * Generate test cases using Gemini AI
   * @param {Array} files - Array of file objects with content
   * @param {Object} config - Configuration for test generation
   * @returns {Promise<Array>} Generated test cases
   */
  async generateTestCases(files, config = {}) {
    const prompt = this.buildTestGenerationPrompt(files, config);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseTestCasesResponse(text, files, config);
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  /**
   * Generate summary and insights for test cases
   * @param {Array} testCases - Array of test case objects
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Summary and insights
   */
  async generateSummary(testCases, metadata = {}) {
    const prompt = this.buildSummaryPrompt(testCases, metadata);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseSummaryResponse(text, testCases);
    } catch (error) {
      console.error('Gemini Summary Error:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze code complexity and provide recommendations
   * @param {Array} files - Array of file objects
   * @returns {Promise<Object>} Code analysis results
   */
  async analyzeCode(files) {
    const prompt = this.buildCodeAnalysisPrompt(files);

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return this.parseCodeAnalysisResponse(text, files);
    } catch (error) {
      console.error('Gemini Code Analysis Error:', error);
      throw new Error(`Code analysis failed: ${error.message}`);
    }
  }

  /**
   * Build prompt for test case generation
   */
  buildTestGenerationPrompt(files, config) {
    const { types = ['unit'], complexity = 'medium', framework = 'auto' } = config;

    const codeContext = files
      .map(
        (file) => `
File: ${file.path}
Language: ${this.detectLanguage(file.path)}
Content:
\`\`\`
${file.content?.substring(0, 4000) || 'Content not available'}
\`\`\`
`
      )
      .join('\n');

    return `You are an expert software testing engineer. Analyze the provided code and generate comprehensive test cases.

${codeContext}

Requirements:
- Test types: ${types.join(', ')}  
- Complexity: ${complexity}
- Framework: ${framework === 'auto' ? 'most appropriate for the language' : framework}
- Generate practical, executable test cases
- Include edge cases and error handling
- Follow testing best practices

Respond ONLY with valid JSON in this exact format:
{
  "testCases": [
    {
      "id": "unique_id",
      "title": "Test case title",
      "description": "What this test validates",
      "type": "unit|integration|e2e",
      "priority": "low|medium|high|critical",
      "file": "source_file_path",
      "function": "function_name_if_applicable",
      "code": "complete_test_code_with_framework_syntax",
      "setup": "setup_code_if_needed",
      "teardown": "cleanup_code_if_needed",
      "dependencies": ["dependency1", "dependency2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

Generate ${Math.min(files.length * 3, 10)} relevant test cases.`;
  }

  /**
   * Build prompt for summary generation
   */
  buildSummaryPrompt(testCases, metadata) {
    const testSummary = testCases
      .map((tc) => `- ${tc.title} (${tc.type}, ${tc.priority}): ${tc.description}`)
      .join('\n');

    return `Analyze these test cases and provide insights:

Test Cases:
${testSummary}

Repository: ${metadata.repository || 'Unknown'}
Files: ${metadata.files?.length || 0}

Respond ONLY with valid JSON:
{
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "coverage": "Overall coverage analysis text",
  "gaps": ["potential_gap1", "potential_gap2"],
  "qualityScore": 85,
  "executionTime": "estimated_time_in_minutes"
}`;
  }

  /**
   * Build prompt for code analysis
   */
  buildCodeAnalysisPrompt(files) {
    const codeSnippets = files
      .map(
        (file) => `
File: ${file.path}
Size: ${file.size || 0} bytes
Content Sample:
\`\`\`
${file.content?.substring(0, 2000) || 'Content not available'}
\`\`\`
`
      )
      .join('\n');

    return `Analyze the following code files for complexity, quality, and testing needs:

${codeSnippets}

Respond ONLY with valid JSON:
{
  "files": [
    {
      "path": "file_path",
      "complexity": "low|medium|high",
      "maintainability": "score_0_to_100",
      "testability": "easy|moderate|difficult",
      "recommendations": ["rec1", "rec2"],
      "issues": ["issue1", "issue2"],
      "metrics": {
        "linesOfCode": 0,
        "cyclomaticComplexity": 0,
        "functions": 0,
        "classes": 0
      }
    }
  ],
  "overall": {
    "averageComplexity": "medium",
    "totalLines": 0,
    "riskLevel": "low|medium|high",
    "testingPriority": "Priority areas for testing"
  }
}`;
  }

  /**
   * Parse test cases response from AI
   */
  parseTestCasesResponse(text, files, config) {
    try {
      // Clean the response and extract JSON
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.testCases && Array.isArray(parsed.testCases)) {
          return parsed.testCases.map((tc, index) => ({
            id: tc.id || `ai_${Date.now()}_${index}`,
            title: tc.title || `Test Case ${index + 1}`,
            description: tc.description || 'AI generated test case',
            type: tc.type || config.types?.[0] || 'unit',
            priority: tc.priority || 'medium',
            file: tc.file || files[0]?.path || 'unknown',
            function: tc.function || null,
            code: tc.code || '// Test implementation needed',
            setup: tc.setup || null,
            teardown: tc.teardown || null,
            dependencies: tc.dependencies || [],
            tags: tc.tags || [],
            generatedBy: 'gemini-ai',
            createdAt: new Date().toISOString(),
          }));
        }
      }

      // Fallback parsing
      return this.createFallbackTestCases(text, files, config);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.createFallbackTestCases(text, files, config);
    }
  }

  /**
   * Parse summary response from AI
   */
  parseSummaryResponse(text, testCases) {
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          insights: parsed.insights || [],
          recommendations: parsed.recommendations || [],
          coverage: parsed.coverage || 'Analysis not available',
          gaps: parsed.gaps || [],
          qualityScore: parsed.qualityScore || 75,
          executionTime: parsed.executionTime || '15-30 minutes',
        };
      }
    } catch (error) {
      console.error('Error parsing summary response:', error);
    }

    // Fallback summary
    return this.createFallbackSummary(testCases);
  }

  /**
   * Parse code analysis response from AI
   */
  parseCodeAnalysisResponse(text, files) {
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error parsing code analysis response:', error);
    }

    // Fallback analysis
    return this.createFallbackAnalysis(files);
  }

  /**
   * Create fallback test cases when AI parsing fails
   */
  createFallbackTestCases(text, files, config) {
    const testCases = [];

    files.forEach((file, index) => {
      const language = this.detectLanguage(file.path);
      const framework = this.getDefaultFramework(language);

      config.types?.forEach((type, typeIndex) => {
        testCases.push({
          id: `fallback_${Date.now()}_${index}_${typeIndex}`,
          title: `${type} test for ${file.name || file.path}`,
          description: `Generated ${type} test case for ${file.path}`,
          type,
          priority: 'medium',
          file: file.path,
          code: this.generateTemplateCode(language, framework, type, file),
          dependencies: this.getFrameworkDependencies(framework),
          generatedBy: 'fallback',
          createdAt: new Date().toISOString(),
        });
      });
    });

    return testCases;
  }

  /**
   * Create fallback summary
   */
  createFallbackSummary(testCases) {
    const types = {};
    const priorities = {};

    testCases.forEach((tc) => {
      types[tc.type] = (types[tc.type] || 0) + 1;
      priorities[tc.priority] = (priorities[tc.priority] || 0) + 1;
    });

    return {
      insights: [
        `Generated ${testCases.length} test cases`,
        `Test types: ${Object.keys(types).join(', ')}`,
        `Most common priority: ${Object.entries(priorities).sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium'}`,
      ],
      recommendations: [
        'Review and customize generated test cases',
        'Add specific assertions for your business logic',
        'Consider adding more edge case tests',
      ],
      coverage: `Test suite includes ${Object.keys(types).length} test types focusing on ${Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unit'} testing.`,
      gaps: [],
      qualityScore: Math.min(85, Math.max(60, testCases.length * 5)),
      executionTime: `${Math.ceil(testCases.length * 2)} minutes`,
    };
  }

  /**
   * Create fallback code analysis
   */
  createFallbackAnalysis(files) {
    return {
      files: files.map((file) => ({
        path: file.path,
        complexity: 'medium',
        maintainability: 75,
        testability: 'moderate',
        recommendations: ['Add unit tests', 'Consider refactoring large functions'],
        issues: [],
        metrics: {
          linesOfCode: file.content?.split('\n').length || 0,
          cyclomaticComplexity: 5,
          functions: (file.content?.match(/function|def|class/g) || []).length,
          classes: (file.content?.match(/class /g) || []).length,
        },
      })),
      overall: {
        averageComplexity: 'medium',
        totalLines: files.reduce((sum, file) => sum + (file.content?.split('\n').length || 0), 0),
        riskLevel: 'low',
        testingPriority: 'Focus on core business logic and public APIs',
      },
    };
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
    };
    return languageMap[ext] || 'unknown';
  }

  /**
   * Get default testing framework for a language
   */
  getDefaultFramework(language) {
    const frameworkMap = {
      javascript: 'jest',
      typescript: 'jest',
      python: 'pytest',
      java: 'junit',
      csharp: 'nunit',
      php: 'phpunit',
      ruby: 'rspec',
      go: 'testing',
      rust: 'cargo test',
    };
    return frameworkMap[language] || 'generic';
  }

  /**
   * Get framework dependencies
   */
  getFrameworkDependencies(framework) {
    const deps = {
      jest: ['jest', '@types/jest'],
      mocha: ['mocha', 'chai'],
      pytest: ['pytest'],
      junit: ['junit'],
      nunit: ['NUnit'],
      phpunit: ['phpunit/phpunit'],
      rspec: ['rspec'],
    };
    return deps[framework] || [];
  }

  /**
   * Generate template code for fallback cases
   */
  generateTemplateCode(language, framework, type, file) {
    const templates = {
      javascript: {
        jest: `describe('${file.name || file.path}', () => {
  test('should work correctly', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});`,
      },
      python: {
        pytest: `def test_${file.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'module'}():
    """Test basic functionality"""
    # TODO: Implement test
    assert True`,
      },
    };

    return templates[language]?.[framework] || `// TODO: Implement ${type} test for ${file.path}`;
  }
}

module.exports = new GeminiService();

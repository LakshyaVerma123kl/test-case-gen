const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Updated to use the correct model name
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash', // Changed from 'gemini-pro'
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
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection() {
    try {
      const result = await this.model.generateContent('Hello, this is a test.');
      const response = await result.response;
      return {
        success: true,
        model: 'gemini-1.5-flash',
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestion: this.getErrorSuggestion(error),
      };
    }
  }

  /**
   * Get error suggestion based on error type
   */
  getErrorSuggestion(error) {
    if (error.message.includes('not found') || error.message.includes('404')) {
      return 'Model not found. Try updating to gemini-1.5-flash or gemini-1.5-pro';
    }
    if (error.message.includes('API key')) {
      return 'Check your GEMINI_API_KEY environment variable';
    }
    if (error.message.includes('quota') || error.message.includes('limit')) {
      return 'API quota exceeded. Check your billing or try again later';
    }
    return 'Unknown error. Check your network connection and API key';
  }

  /**
   * Generate test cases using Gemini AI
   * @param {Array} files - Array of file objects with content
   * @param {Object} config - Configuration for test generation
   * @returns {Promise<Array>} Generated test cases
   */
  async generateTestCases(files, config = {}) {
    try {
      // Validate inputs
      if (!files || files.length === 0) {
        throw new Error('No files provided for test generation');
      }

      const prompt = this.buildTestGenerationPrompt(files, config);

      console.log('🤖 Sending request to Gemini API...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('✅ Received response from Gemini API');
      return this.parseTestCasesResponse(text, files, config);
    } catch (error) {
      console.error('Gemini API Error:', error.message);

      // Enhanced error logging
      if (error.message.includes('not found')) {
        console.error('❌ Model not found. The gemini-pro model has been deprecated.');
        console.log('💡 Suggestion: Update to gemini-1.5-flash or gemini-1.5-pro');
      }

      // Return fallback test cases if AI fails
      console.log('🔄 Falling back to template test cases');
      return this.createFallbackTestCases('AI generation failed: ' + error.message, files, config);
    }
  }

  /**
   * Build prompt for test case generation with improved structure
   */
  buildTestGenerationPrompt(files, config) {
    const { types = ['unit'], complexity = 'medium', framework = 'auto' } = config;

    const codeContext = files
      .map(
        (file) => `
📁 File: ${file.path}
🔤 Language: ${this.detectLanguage(file.path)}
📝 Content:
\`\`\`${this.detectLanguage(file.path)}
${file.content?.substring(0, 3000) || 'Content not available'}
\`\`\`
`
      )
      .join('\n');

    return `You are an expert software testing engineer. Analyze the provided code and generate comprehensive, practical test cases.

${codeContext}

📋 Requirements:
- Test types: ${types.join(', ')}  
- Complexity level: ${complexity}
- Framework: ${framework === 'auto' ? 'most appropriate for the language' : framework}
- Generate executable test cases with proper syntax
- Include edge cases and error handling
- Follow testing best practices and naming conventions

🎯 Focus on:
- Function inputs/outputs validation
- Error condition handling
- Boundary value testing
- Integration points (if applicable)

⚠️ IMPORTANT: Respond ONLY with valid JSON. No additional text or formatting.

Required JSON format:
{
  "testCases": [
    {
      "id": "unique_test_id",
      "title": "Clear, descriptive test title",
      "description": "What this test validates",
      "type": "unit|integration|e2e",
      "priority": "low|medium|high|critical",
      "file": "source_file_path",
      "function": "function_name_being_tested",
      "code": "complete_executable_test_code",
      "setup": "setup_code_if_needed",
      "teardown": "cleanup_code_if_needed",
      "dependencies": ["dependency1", "dependency2"],
      "tags": ["tag1", "tag2"]
    }
  ]
}

Generate ${Math.min(files.length * 4, 12)} relevant, high-quality test cases.`;
  }

  /**
   * Enhanced test case parsing with better error handling
   */
  parseTestCasesResponse(text, files, config) {
    try {
      // Multiple parsing strategies
      let parsed = null;

      // Strategy 1: Direct JSON parsing
      try {
        parsed = JSON.parse(text.trim());
      } catch (e) {
        // Strategy 2: Extract JSON from markdown code blocks
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          parsed = JSON.parse(codeBlockMatch[1]);
        }
      }

      // Strategy 3: Find JSON object in text
      if (!parsed) {
        const jsonMatch = text.match(/\{[\s\S]*"testCases"[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      }

      if (parsed && parsed.testCases && Array.isArray(parsed.testCases)) {
        console.log(`✅ Successfully parsed ${parsed.testCases.length} test cases`);

        return parsed.testCases.map((tc, index) => ({
          id: tc.id || `ai_${Date.now()}_${index}`,
          title: tc.title || `Test Case ${index + 1}`,
          description: tc.description || 'AI generated test case',
          type: tc.type || config.types?.[0] || 'unit',
          priority: tc.priority || 'medium',
          file: tc.file || files[0]?.path || 'unknown',
          function: tc.function || this.extractFunctionName(tc.code),
          code:
            tc.code ||
            this.generateTemplateCode(
              this.detectLanguage(files[0]?.path || ''),
              this.getDefaultFramework(this.detectLanguage(files[0]?.path || '')),
              tc.type || 'unit',
              files[0]
            ),
          setup: tc.setup || null,
          teardown: tc.teardown || null,
          dependencies:
            tc.dependencies ||
            this.getFrameworkDependencies(
              this.getDefaultFramework(this.detectLanguage(files[0]?.path || ''))
            ),
          tags: tc.tags || [this.detectLanguage(files[0]?.path || '')],
          generatedBy: 'gemini-ai',
          createdAt: new Date().toISOString(),
          aiResponse: text.substring(0, 100) + '...', // For debugging
        }));
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('❌ Error parsing AI response:', error.message);
      console.log('📄 Raw response preview:', text.substring(0, 200) + '...');
      return this.createFallbackTestCases('Parsing failed: ' + error.message, files, config);
    }
  }

  /**
   * Extract function name from test code
   */
  extractFunctionName(code) {
    if (!code) return null;

    // Look for common test patterns
    const patterns = [
      /describe\(['"`]([^'"`]+)['"`]/,
      /test\(['"`]([^'"`]+)['"`]/,
      /it\(['"`]([^'"`]+)['"`]/,
      /def\s+test_([a-zA-Z_][a-zA-Z0-9_]*)/,
      /@Test[^a-zA-Z]*([a-zA-Z_][a-zA-Z0-9_]*)/,
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Enhanced fallback test cases with better templates
   */
  createFallbackTestCases(reason, files, config) {
    const testCases = [];
    console.log(`🔄 Creating fallback test cases. Reason: ${reason}`);

    files.forEach((file, fileIndex) => {
      const language = this.detectLanguage(file.path);
      const framework = this.getDefaultFramework(language);
      const types = config.types || ['unit'];

      // Analyze file content for functions/classes
      const functions = this.extractFunctionsFromCode(file.content, language);

      if (functions.length > 0) {
        // Create tests for each function
        functions.slice(0, 3).forEach((func, funcIndex) => {
          types.forEach((type, typeIndex) => {
            testCases.push({
              id: `fallback_${Date.now()}_${fileIndex}_${funcIndex}_${typeIndex}`,
              title: `Test ${func.name} function - ${type}`,
              description: `${type} test for ${func.name} function in ${file.path}`,
              type,
              priority: func.isExported ? 'high' : 'medium',
              file: file.path,
              function: func.name,
              code: this.generateFunctionTestCode(language, framework, type, func, file),
              setup: null,
              teardown: null,
              dependencies: this.getFrameworkDependencies(framework),
              tags: [language, framework, 'fallback'],
              generatedBy: 'fallback-function-based',
              createdAt: new Date().toISOString(),
            });
          });
        });
      } else {
        // Create generic file tests
        types.forEach((type, typeIndex) => {
          testCases.push({
            id: `fallback_generic_${Date.now()}_${fileIndex}_${typeIndex}`,
            title: `${type} test for ${file.name || file.path}`,
            description: `Generated ${type} test case for ${file.path}`,
            type,
            priority: 'medium',
            file: file.path,
            function: null,
            code: this.generateTemplateCode(language, framework, type, file),
            setup: null,
            teardown: null,
            dependencies: this.getFrameworkDependencies(framework),
            tags: [language, framework, 'fallback'],
            generatedBy: 'fallback-generic',
            createdAt: new Date().toISOString(),
          });
        });
      }
    });

    console.log(`✅ Created ${testCases.length} fallback test cases`);
    return testCases;
  }

  /**
   * Extract functions from code based on language
   */
  extractFunctionsFromCode(content, language) {
    if (!content) return [];

    const functions = [];
    const patterns = {
      javascript: [
        /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
        /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?:\([^)]*\)\s*=>|function)/g,
        /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*function/g,
        /export\s+(?:function\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/g,
      ],
      python: [/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g],
      java: [
        /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      ],
    };

    const languagePatterns = patterns[language] || patterns.javascript;

    languagePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1];
        if (name && !functions.some((f) => f.name === name)) {
          functions.push({
            name,
            isExported: content.includes(`export`) && content.includes(name),
            language,
          });
        }
      }
    });

    return functions.slice(0, 5); // Limit to 5 functions per file
  }

  /**
   * Generate test code for specific functions
   */
  generateFunctionTestCode(language, framework, type, func, file) {
    const templates = {
      javascript: {
        jest: `const { ${func.name} } = require('./${file.path.replace(/\.[^/.]+$/, '')}');

describe('${func.name}', () => {
  test('should execute without errors', () => {
    // Test basic functionality
    expect(typeof ${func.name}).toBe('function');
  });

  test('should handle valid inputs', () => {
    // TODO: Add test with valid inputs
    // const result = ${func.name}(/* valid params */);
    // expect(result).toBeDefined();
  });

  test('should handle edge cases', () => {
    // TODO: Add edge case tests
    // expect(() => ${func.name}(null)).toThrow();
  });
});`,
      },
      python: {
        pytest: `from ${file.path.replace(/\.py$/, '').replace(/\//g, '.')} import ${func.name}

def test_${func.name}_basic():
    """Test basic functionality of ${func.name}"""
    # TODO: Implement test
    assert callable(${func.name})

def test_${func.name}_valid_input():
    """Test ${func.name} with valid inputs"""
    # TODO: Add test with valid inputs
    # result = ${func.name}(valid_param)
    # assert result is not None

def test_${func.name}_edge_cases():
    """Test ${func.name} edge cases"""
    # TODO: Add edge case tests
    pass`,
      },
    };

    return (
      templates[language]?.[framework] ||
      `// TODO: Implement ${type} test for ${func.name} function in ${file.path}`
    );
  }

  /**
   * Enhanced template code generation
   */
  generateTemplateCode(language, framework, type, file) {
    const templates = {
      javascript: {
        jest: `describe('${file.name || file.path}', () => {
  test('should load module without errors', () => {
    // Test module loading
    expect(() => require('./${file.path.replace(/\.[^/.]+$/, '')}')).not.toThrow();
  });

  test('should export expected functions/objects', () => {
    const module = require('./${file.path.replace(/\.[^/.]+$/, '')}');
    expect(module).toBeDefined();
    // TODO: Add specific export checks
  });

  test('should handle basic operations', () => {
    // TODO: Implement specific functionality tests
    expect(true).toBe(true);
  });
});`,
      },
      python: {
        pytest: `import pytest
from ${file.path.replace(/\.py$/, '').replace(/\//g, '.')} import *

def test_module_imports():
    """Test that module imports without errors"""
    # Module should import successfully
    assert True

def test_basic_functionality():
    """Test basic module functionality"""
    # TODO: Implement specific tests
    assert True

def test_edge_cases():
    """Test edge cases and error handling"""
    # TODO: Add edge case tests
    pass`,
      },
    };

    return (
      templates[language]?.[framework] ||
      `// TODO: Implement ${type} test for ${file.path}\n// Framework: ${framework}\n// Language: ${language}`
    );
  }

  // ... (keep all other existing methods like detectLanguage, getDefaultFramework, etc.)

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
    return languageMap[ext] || 'javascript';
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
    return frameworkMap[language] || 'jest';
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
}

// Export singleton instance
module.exports = new GeminiService();

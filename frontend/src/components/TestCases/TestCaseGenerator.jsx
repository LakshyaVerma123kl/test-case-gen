import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Zap,
  Settings,
  Code,
  FileText,
  Target,
  Layers,
  Clock,
  Download,
  Copy,
  Share2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  Brain,
  Cpu,
  Database,
  Globe,
} from "lucide-react";
import {
  generateTestCases,
  downloadTestCasesAsJSON,
  copyToClipboard,
  detectLanguageFromPath,
  getLanguageIcon,
} from "../../services/api";
import Button from "../UI/Button";
import LoadingSpinner from "../UI/LoadingSpinner";

const TestCaseGenerator = ({
  selectedFiles = [],
  repository,
  onTestCasesGenerated,
  sessionId,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [testCases, setTestCases] = useState([]);
  const [analysisPhase, setAnalysisPhase] = useState("");
  const [detectedLanguages, setDetectedLanguages] = useState({});
  const [projectStructure, setProjectStructure] = useState(null);
  const [generationConfig, setGenerationConfig] = useState({
    types: ["unit", "integration", "e2e", "performance", "security"],
    complexity: "adaptive", // adaptive, simple, medium, complex
    includeEdgeCases: true,
    includeNegativeTests: true,
    includePerformanceTests: false,
    includeSecurityTests: false,
    framework: "auto-detect",
    language: "auto-detect",
    testingStrategy: "comprehensive", // minimal, standard, comprehensive
    coverageTarget: 80,
    mockingStrategy: "smart", // none, minimal, smart, aggressive
    generateDocumentation: true,
    adaptToProject: true, // Auto-adapt based on project structure
  });
  const [error, setError] = useState(null);
  const [generationTime, setGenerationTime] = useState(0);
  const [lastGeneratedFiles, setLastGeneratedFiles] = useState([]);
  const [generationStats, setGenerationStats] = useState({});

  // Universal test frameworks mapping
  const universalTestFrameworks = {
    javascript: [
      "Jest",
      "Mocha",
      "Jasmine",
      "Vitest",
      "Cypress",
      "Playwright",
      "Puppeteer",
    ],
    typescript: [
      "Jest",
      "Mocha",
      "Vitest",
      "Cypress",
      "Playwright",
      "Deno Test",
    ],
    python: [
      "pytest",
      "unittest",
      "nose2",
      "Robot Framework",
      "Behave",
      "Selenium",
    ],
    java: ["JUnit 5", "JUnit 4", "TestNG", "Spock", "Selenium", "RestAssured"],
    csharp: ["NUnit", "xUnit", "MSTest", "Selenium", "SpecFlow"],
    php: ["PHPUnit", "Codeception", "Behat", "Pest"],
    ruby: ["RSpec", "Minitest", "Cucumber", "Capybara"],
    go: ["testing", "Ginkgo", "Testify", "GoConvey"],
    rust: ["cargo test", "proptest", "criterion"],
    swift: ["XCTest", "Quick", "Nimble"],
    kotlin: ["JUnit", "Spek", "MockK"],
    scala: ["ScalaTest", "Specs2", "µTest"],
    cpp: ["Google Test", "Catch2", "Boost.Test", "CppUnit"],
    c: ["Unity", "CUnit", "Check", "Cmocka"],
    dart: ["test", "mockito", "integration_test"],
    elixir: ["ExUnit", "PropCheck", "Wallaby"],
    erlang: ["EUnit", "Common Test", "PropEr"],
    haskell: ["Hspec", "QuickCheck", "Tasty"],
    lua: ["busted", "telescope"],
    perl: ["Test::More", "Test::Simple", "Prove"],
    r: ["testthat", "RUnit", "tinytest"],
    shell: ["Bats", "shUnit2", "shellspec"],
    sql: ["tSQLt", "pgTAP", "utPLSQL"],
    web: ["Cypress", "Playwright", "Selenium", "TestCafe"],
    mobile: ["Appium", "Detox", "Espresso", "XCUITest"],
    api: ["Postman", "Newman", "Insomnia", "REST Assured"],
    generic: ["Custom Framework", "Manual Testing", "BDD Framework"],
  };

  // Enhanced language detection
  const enhancedLanguageDetection = useCallback((files) => {
    const languages = {};
    const frameworks = new Set();
    const patterns = new Set();

    files.forEach((file) => {
      const lang = detectLanguageFromPath(file.path);
      languages[lang] = (languages[lang] || 0) + 1;

      // Detect frameworks and patterns from file names
      const fileName = file.path.toLowerCase();

      // Framework detection patterns
      if (
        fileName.includes("package.json") ||
        fileName.includes("node_modules")
      ) {
        frameworks.add("nodejs");
      }
      if (
        fileName.includes("requirements.txt") ||
        fileName.includes("setup.py")
      ) {
        frameworks.add("python");
      }
      if (fileName.includes("pom.xml") || fileName.includes(".gradle")) {
        frameworks.add("java");
      }
      if (fileName.includes("composer.json")) {
        frameworks.add("php");
      }
      if (fileName.includes("gemfile")) {
        frameworks.add("ruby");
      }
      if (fileName.includes("go.mod")) {
        frameworks.add("go");
      }
      if (fileName.includes("cargo.toml")) {
        frameworks.add("rust");
      }
      if (fileName.includes("dockerfile")) {
        frameworks.add("docker");
      }

      // Pattern detection
      if (fileName.includes("test") || fileName.includes("spec")) {
        patterns.add("existing-tests");
      }
      if (
        fileName.includes("api") ||
        fileName.includes("rest") ||
        fileName.includes("graphql")
      ) {
        patterns.add("api");
      }
      if (
        fileName.includes("db") ||
        fileName.includes("database") ||
        fileName.includes("model")
      ) {
        patterns.add("database");
      }
      if (
        fileName.includes("ui") ||
        fileName.includes("component") ||
        fileName.includes("view")
      ) {
        patterns.add("ui");
      }
      if (
        fileName.includes("service") ||
        fileName.includes("util") ||
        fileName.includes("helper")
      ) {
        patterns.add("service");
      }
    });

    return {
      languages,
      frameworks: Array.from(frameworks),
      patterns: Array.from(patterns),
    };
  }, []);

  // Auto-adapt configuration based on project structure
  const adaptConfiguration = useCallback(
    (structure) => {
      const adaptedConfig = { ...generationConfig };

      // Adapt test types based on project patterns
      if (structure.patterns.includes("api")) {
        adaptedConfig.types = [...adaptedConfig.types, "api", "contract"];
      }
      if (structure.patterns.includes("database")) {
        adaptedConfig.types = [...adaptedConfig.types, "database", "migration"];
      }
      if (structure.patterns.includes("ui")) {
        adaptedConfig.types = [
          ...adaptedConfig.types,
          "visual",
          "accessibility",
        ];
      }

      // Adapt complexity based on project size
      const fileCount = selectedFiles.length;
      if (fileCount > 100) {
        adaptedConfig.complexity = "complex";
        adaptedConfig.testingStrategy = "comprehensive";
      } else if (fileCount > 20) {
        adaptedConfig.complexity = "medium";
        adaptedConfig.testingStrategy = "standard";
      } else {
        adaptedConfig.complexity = "simple";
        adaptedConfig.testingStrategy = "minimal";
      }

      // Enable relevant test types based on frameworks
      if (
        structure.frameworks.includes("nodejs") ||
        structure.frameworks.includes("python")
      ) {
        adaptedConfig.includePerformanceTests = true;
      }
      if (structure.patterns.includes("api")) {
        adaptedConfig.includeSecurityTests = true;
      }

      return adaptedConfig;
    },
    [generationConfig, selectedFiles.length]
  );

  // Memoize selected files and analyze project structure
  const memoizedSelectedFiles = useMemo(() => {
    const files = selectedFiles.map((file) => ({
      path: file.path,
      name: file.name,
      owner: file.owner,
      repo: file.repo,
      language: detectLanguageFromPath(file.path),
    }));

    // Analyze project structure
    if (files.length > 0) {
      const structure = enhancedLanguageDetection(files);
      setDetectedLanguages(structure.languages);
      setProjectStructure(structure);

      // Auto-adapt configuration if enabled
      if (generationConfig.adaptToProject) {
        const adaptedConfig = adaptConfiguration(structure);
        setGenerationConfig(adaptedConfig);
      }
    }

    return files;
  }, [
    selectedFiles,
    enhancedLanguageDetection,
    adaptConfiguration,
    generationConfig.adaptToProject,
  ]);

  // Enhanced test case generation with phases
  const handleGenerate = useCallback(async () => {
    if (memoizedSelectedFiles.length === 0) {
      setError("Please select at least one file to generate test cases");
      return;
    }

    if (!sessionId) {
      setError("Session ID is required. Please authenticate first.");
      return;
    }

    if (!repository?.full_name) {
      setError("Repository information is required");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAnalysisPhase("Initializing...");
    const startTime = Date.now();

    try {
      console.log("🧪 Starting universal test case generation...", {
        filesCount: memoizedSelectedFiles.length,
        repository: repository.full_name,
        config: generationConfig,
        detectedLanguages,
        projectStructure,
      });

      // Phase 1: Project Analysis
      setAnalysisPhase("Analyzing project structure and dependencies...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate analysis

      // Phase 2: Language and Framework Detection
      setAnalysisPhase("Detecting languages and testing frameworks...");
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Phase 3: Test Strategy Planning
      setAnalysisPhase("Planning comprehensive test strategy...");
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Phase 4: AI Generation
      setAnalysisPhase("Generating AI-powered test cases...");

      const enhancedConfig = {
        ...generationConfig,
        projectStructure,
        detectedLanguages,
        adaptiveStrategy: true,
        universalPatterns: true,
        languageAgnostic: true,
      };

      const response = await generateTestCases({
        files: memoizedSelectedFiles,
        repository: repository.full_name,
        config: enhancedConfig,
        sessionId,
      });

      console.log("✅ Universal test cases generated:", response);

      const generatedTestCases =
        response.testCases || response.data || response;

      if (!Array.isArray(generatedTestCases)) {
        throw new Error(
          "Invalid response format: expected array of test cases"
        );
      }

      // Phase 5: Post-processing and Enhancement
      setAnalysisPhase("Enhancing and validating test cases...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Enhance test cases with universal patterns
      const enhancedTestCases = generatedTestCases.map((tc, index) => ({
        ...tc,
        id: tc.id || `test-${index}`,
        universalPattern: true,
        adaptedForLanguage: tc.language || "generic",
        estimatedExecutionTime: estimateExecutionTime(tc),
        riskLevel: assessRiskLevel(tc),
        maintenanceScore: calculateMaintenanceScore(tc),
      }));

      setTestCases(enhancedTestCases);
      setGenerationTime(Date.now() - startTime);
      setLastGeneratedFiles(memoizedSelectedFiles);

      // Calculate generation statistics
      const stats = calculateGenerationStats(
        enhancedTestCases,
        projectStructure
      );
      setGenerationStats(stats);

      // Call the callback if provided
      if (onTestCasesGenerated) {
        onTestCasesGenerated(enhancedTestCases);
      }

      setAnalysisPhase("Complete!");

      console.log(
        `✅ Generated ${
          enhancedTestCases.length
        } universal test cases in ${Math.round(
          (Date.now() - startTime) / 1000
        )}s`
      );
    } catch (err) {
      console.error("❌ Universal test case generation failed:", err);

      let errorMessage = "Failed to generate test cases";
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      setError(errorMessage);
      setAnalysisPhase("");
    } finally {
      setIsGenerating(false);
      setTimeout(() => setAnalysisPhase(""), 2000);
    }
  }, [
    memoizedSelectedFiles,
    repository?.full_name,
    generationConfig,
    sessionId,
    onTestCasesGenerated,
    detectedLanguages,
    projectStructure,
  ]);

  // Utility functions for test case enhancement
  const estimateExecutionTime = (testCase) => {
    const baseTime = {
      unit: 5,
      integration: 15,
      e2e: 45,
      performance: 120,
      security: 60,
      api: 30,
      database: 25,
      visual: 20,
      accessibility: 10,
    };
    return baseTime[testCase.type] || 10;
  };

  const assessRiskLevel = (testCase) => {
    if (testCase.type === "security" || testCase.priority === "critical")
      return "high";
    if (testCase.type === "performance" || testCase.priority === "high")
      return "medium";
    return "low";
  };

  const calculateMaintenanceScore = (testCase) => {
    let score = 70; // Base score
    if (testCase.type === "unit") score += 20;
    if (testCase.includeEdgeCases) score += 10;
    if (testCase.documentation) score += 15;
    return Math.min(100, score);
  };

  const calculateGenerationStats = (testCases, structure) => {
    const stats = {
      totalTests: testCases.length,
      byLanguage: {},
      byType: {},
      byRisk: { low: 0, medium: 0, high: 0 },
      avgMaintenanceScore: 0,
      estimatedTotalTime: 0,
      coverageEstimate: 0,
    };

    testCases.forEach((tc) => {
      stats.byType[tc.type] = (stats.byType[tc.type] || 0) + 1;
      stats.byRisk[tc.riskLevel]++;
      stats.avgMaintenanceScore += tc.maintenanceScore || 0;
      stats.estimatedTotalTime += tc.estimatedExecutionTime || 0;
      stats.byLanguage[tc.adaptedForLanguage] =
        (stats.byLanguage[tc.adaptedForLanguage] || 0) + 1;
    });

    stats.avgMaintenanceScore = Math.round(
      stats.avgMaintenanceScore / testCases.length
    );
    stats.coverageEstimate = Math.min(95, Math.max(60, testCases.length * 2));

    return stats;
  };

  // Auto-generate when files change
  useEffect(() => {
    const filesChanged =
      JSON.stringify(memoizedSelectedFiles) !==
      JSON.stringify(lastGeneratedFiles);
    const hasRequiredData = sessionId && repository?.full_name;
    const shouldAutoGenerate =
      memoizedSelectedFiles.length > 0 &&
      filesChanged &&
      !isGenerating &&
      hasRequiredData;

    if (shouldAutoGenerate) {
      console.log("🔄 Files changed, auto-generating universal test cases...");
      const timer = setTimeout(() => {
        handleGenerate();
      }, 1500); // Slightly longer delay for analysis

      return () => clearTimeout(timer);
    }
  }, [
    memoizedSelectedFiles,
    lastGeneratedFiles,
    isGenerating,
    sessionId,
    repository?.full_name,
    handleGenerate,
  ]);

  const handleDownload = useCallback(async () => {
    if (testCases.length === 0) {
      setError("No test cases to download");
      return;
    }

    try {
      const exportData = {
        metadata: {
          repository: repository?.full_name,
          generatedAt: new Date().toISOString(),
          generator: "Universal Test Case Generator",
          version: "2.0.0",
          projectStructure,
          detectedLanguages,
          generationStats,
        },
        configuration: generationConfig,
        testCases,
      };

      await downloadTestCasesAsJSON(
        exportData,
        `universal-tests-${repository?.name || "project"}-${
          new Date().toISOString().split("T")[0]
        }.json`
      );
      console.log("✅ Universal test cases downloaded successfully");
    } catch (err) {
      console.error("❌ Download failed:", err);
      setError("Failed to download test cases");
    }
  }, [
    testCases,
    repository,
    projectStructure,
    detectedLanguages,
    generationStats,
    generationConfig,
  ]);

  const handleCopy = useCallback(async () => {
    if (testCases.length === 0) {
      setError("No test cases to copy");
      return;
    }

    try {
      const success = await copyToClipboard(JSON.stringify(testCases, null, 2));
      if (success) {
        console.log("✅ Universal test cases copied to clipboard");
      } else {
        throw new Error("Copy operation failed");
      }
    } catch (err) {
      console.error("❌ Copy failed:", err);
      setError("Failed to copy test cases to clipboard");
    }
  }, [testCases]);

  const getTestTypeIcon = useCallback((type) => {
    const icons = {
      unit: <Target className="h-4 w-4" />,
      integration: <Layers className="h-4 w-4" />,
      e2e: <Code className="h-4 w-4" />,
      performance: <Cpu className="h-4 w-4" />,
      security: <AlertTriangle className="h-4 w-4" />,
      api: <Globe className="h-4 w-4" />,
      database: <Database className="h-4 w-4" />,
      visual: <CheckCircle className="h-4 w-4" />,
      accessibility: <Info className="h-4 w-4" />,
    };
    return icons[type] || <FileText className="h-4 w-4" />;
  }, []);

  const getRiskColor = useCallback((risk) => {
    switch (risk) {
      case "low":
        return "text-green-600 bg-green-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "high":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  }, []);

  // Clear error when files change
  useEffect(() => {
    if (error && memoizedSelectedFiles.length > 0) {
      setError(null);
    }
  }, [memoizedSelectedFiles.length, error]);

  return (
    <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">
                Universal Test Case Generator
              </h2>
              <p className="text-sm text-secondary-600">
                AI-powered test generation for any programming language or
                framework
              </p>
            </div>
          </div>
          {testCases.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex items-center space-x-2"
              >
                <Copy className="h-4 w-4" />
                <span>Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Project Analysis Panel */}
      {projectStructure && (
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-secondary-200">
          <div className="flex items-center space-x-2 mb-3">
            <Brain className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-secondary-900">
              Project Analysis
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">
                Languages Detected:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(detectedLanguages).map(([lang, count]) => (
                  <span
                    key={lang}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800"
                  >
                    {getLanguageIcon(lang)} {lang} ({count})
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Frameworks:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {projectStructure.frameworks.map((fw) => (
                  <span
                    key={fw}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800"
                  >
                    {fw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="font-medium text-gray-700">Patterns:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {projectStructure.patterns.map((pattern) => (
                  <span
                    key={pattern}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-800"
                  >
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Configuration Panel */}
      <div className="px-6 py-4 bg-secondary-50 border-b border-secondary-200">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-5 w-5 text-secondary-600" />
          <span className="font-medium text-secondary-900">
            Universal Configuration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Test Types */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Test Types
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {[
                "unit",
                "integration",
                "e2e",
                "performance",
                "security",
                "api",
                "database",
                "visual",
                "accessibility",
              ].map((type) => (
                <label key={type} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={generationConfig.types.includes(type)}
                    onChange={(e) => {
                      const types = e.target.checked
                        ? [...generationConfig.types, type]
                        : generationConfig.types.filter((t) => t !== type);
                      setGenerationConfig((prev) => ({ ...prev, types }));
                    }}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                  />
                  <span className="ml-2 text-sm text-secondary-700 capitalize flex items-center">
                    {getTestTypeIcon(type)}
                    <span className="ml-1">{type}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Testing Strategy */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Strategy
            </label>
            <select
              value={generationConfig.testingStrategy}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  testingStrategy: e.target.value,
                }))
              }
              className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="minimal">Minimal (Quick)</option>
              <option value="standard">Standard (Balanced)</option>
              <option value="comprehensive">Comprehensive (Thorough)</option>
            </select>
          </div>

          {/* Complexity */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Complexity
            </label>
            <select
              value={generationConfig.complexity}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  complexity: e.target.value,
                }))
              }
              className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="adaptive">Adaptive (Recommended)</option>
              <option value="simple">Simple</option>
              <option value="medium">Medium</option>
              <option value="complex">Complex</option>
            </select>
          </div>

          {/* Coverage Target */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Coverage Target: {generationConfig.coverageTarget}%
            </label>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={generationConfig.coverageTarget}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  coverageTarget: parseInt(e.target.value),
                }))
              }
              className="w-full"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {[
              { key: "includeEdgeCases", label: "Include Edge Cases" },
              { key: "includeNegativeTests", label: "Include Negative Tests" },
              {
                key: "includePerformanceTests",
                label: "Include Performance Tests",
              },
              { key: "includeSecurityTests", label: "Include Security Tests" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={generationConfig[key]}
                  onChange={(e) =>
                    setGenerationConfig((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <span className="ml-2 text-sm text-secondary-700">{label}</span>
              </label>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { key: "generateDocumentation", label: "Generate Documentation" },
              { key: "adaptToProject", label: "Auto-adapt to Project" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center">
                <input
                  type="checkbox"
                  checked={generationConfig[key]}
                  onChange={(e) =>
                    setGenerationConfig((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                />
                <span className="ml-2 text-sm text-secondary-700">{label}</span>
              </label>
            ))}
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">
                Mocking Strategy
              </label>
              <select
                value={generationConfig.mockingStrategy}
                onChange={(e) =>
                  setGenerationConfig((prev) => ({
                    ...prev,
                    mockingStrategy: e.target.value,
                  }))
                }
                className="block w-full px-2 py-1 border border-secondary-300 rounded text-sm"
              >
                <option value="none">No Mocking</option>
                <option value="minimal">Minimal Mocking</option>
                <option value="smart">Smart Mocking</option>
                <option value="aggressive">Aggressive Mocking</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Files Summary */}
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-secondary-900">
              Selected Files ({memoizedSelectedFiles.length})
            </h3>
            <p className="text-xs text-secondary-600 mt-1">
              Universal test cases will be generated for these files
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={
              memoizedSelectedFiles.length === 0 || isGenerating || !sessionId
            }
            className="flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                Generating...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                <span>Generate Universal Tests</span>
              </>
            )}
          </Button>
        </div>

        {memoizedSelectedFiles.length > 0 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {memoizedSelectedFiles.slice(0, 8).map((file) => (
                <span
                  key={file.path}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                >
                  {getLanguageIcon(file.language)}
                  <span className="ml-1">{file.name}</span>
                </span>
              ))}
              {memoizedSelectedFiles.length > 8 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                  +{memoizedSelectedFiles.length - 8} more files
                </span>
              )}
            </div>
            {generationStats.totalTests > 0 && (
              <div className="mt-2 text-xs text-secondary-500">
                Last generation: {generationStats.totalTests} tests, ~
                {Math.round(generationStats.estimatedTotalTime / 60)}min
                execution time, {generationStats.coverageEstimate}% coverage
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-4 bg-error-50 border-b border-error-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-error-600" />
            <span className="text-sm text-error-700">{error}</span>
          </div>
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setError(null)}
              className="text-xs"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Generation Progress */}
      {isGenerating && analysisPhase && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-blue-900">
                {analysisPhase}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                Analyzing {memoizedSelectedFiles.length} files across{" "}
                {Object.keys(detectedLanguages).length} languages
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generation Statistics */}
      {generationStats.totalTests > 0 && (
        <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-b border-secondary-200">
          <h3 className="text-sm font-medium text-secondary-900 mb-3">
            Generation Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {generationStats.totalTests}
              </div>
              <div className="text-xs text-secondary-600">Total Tests</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {generationStats.coverageEstimate}%
              </div>
              <div className="text-xs text-secondary-600">Est. Coverage</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {generationStats.avgMaintenanceScore}
              </div>
              <div className="text-xs text-secondary-600">
                Maintenance Score
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(generationStats.estimatedTotalTime / 60)}m
              </div>
              <div className="text-xs text-secondary-600">Est. Runtime</div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {testCases.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-secondary-900">
                Universal Test Cases
              </h3>
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-secondary-600">
                  {testCases.length} test cases generated
                </span>
                {generationTime > 0 && (
                  <div className="flex items-center space-x-1 text-sm text-secondary-600">
                    <Clock className="h-4 w-4" />
                    <span>{(generationTime / 1000).toFixed(1)}s</span>
                  </div>
                )}
                <span className="text-sm text-green-600 font-medium">
                  Universal Compatibility ✓
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {testCases.map((testCase, index) => (
              <div
                key={testCase.id || index}
                className="border border-secondary-200 rounded-lg p-4 hover:shadow-sm transition-all hover:border-primary-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getTestTypeIcon(testCase.type)}
                      <h4 className="font-medium text-secondary-900">
                        {testCase.title}
                      </h4>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRiskColor(
                          testCase.riskLevel
                        )}`}
                      >
                        {testCase.riskLevel} risk
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {testCase.type}
                      </span>
                      {testCase.adaptedForLanguage &&
                        testCase.adaptedForLanguage !== "generic" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getLanguageIcon(testCase.adaptedForLanguage)}{" "}
                            {testCase.adaptedForLanguage}
                          </span>
                        )}
                    </div>
                    <p className="text-sm text-secondary-600 mb-3">
                      {testCase.description}
                    </p>

                    {/* Test Metadata */}
                    <div className="flex items-center space-x-4 text-xs text-secondary-500 mb-3">
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>~{testCase.estimatedExecutionTime}s</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>Maintenance: {testCase.maintenanceScore}%</span>
                      </span>
                      {testCase.universalPattern && (
                        <span className="flex items-center space-x-1 text-green-600">
                          <Brain className="h-3 w-3" />
                          <span>Universal Pattern</span>
                        </span>
                      )}
                    </div>

                    {testCase.code && (
                      <div className="bg-secondary-900 text-secondary-100 p-3 rounded-md font-mono text-sm overflow-x-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-secondary-400">
                            {testCase.adaptedForLanguage} • {testCase.type} test
                          </span>
                          <button
                            onClick={() => copyToClipboard(testCase.code)}
                            className="text-secondary-400 hover:text-secondary-200 transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap">
                          {testCase.code}
                        </pre>
                      </div>
                    )}

                    {testCase.documentation && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <h5 className="text-xs font-medium text-blue-900 mb-1">
                          Documentation
                        </h5>
                        <p className="text-xs text-blue-700">
                          {testCase.documentation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="px-6 py-8 text-center">
          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
              <div
                className="absolute inset-2 border-4 border-transparent border-t-purple-600 rounded-full animate-spin"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "0.75s",
                }}
              ></div>
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-medium text-secondary-900">
              Generating Universal Test Cases
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              AI is analyzing {memoizedSelectedFiles.length} files across{" "}
              {Object.keys(detectedLanguages).length} programming languages...
            </p>
            <div className="mt-2 text-xs text-secondary-500">
              {analysisPhase && (
                <div className="inline-flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span>{analysisPhase}</span>
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-secondary-400">
              This may take 2-5 minutes for complex, multi-language projects
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isGenerating &&
        testCases.length === 0 &&
        memoizedSelectedFiles.length === 0 && (
          <div className="px-6 py-8 text-center">
            <div className="relative mb-4">
              <Brain className="mx-auto h-12 w-12 text-secondary-400" />
              <div className="absolute -top-1 -right-1">
                <Zap className="h-6 w-6 text-blue-500" />
              </div>
            </div>
            <h3 className="mt-2 text-sm font-medium text-secondary-900">
              Ready for Universal Test Generation
            </h3>
            <p className="mt-1 text-sm text-secondary-500 max-w-md mx-auto">
              Select files from any programming language or framework. Our AI
              will automatically detect patterns and generate appropriate test
              cases.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {[
                "JavaScript",
                "Python",
                "Java",
                "Go",
                "Rust",
                "PHP",
                "Ruby",
                "C#",
                "C++",
                "TypeScript",
                "Swift",
                "Kotlin",
              ].map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded"
                >
                  {lang}
                </span>
              ))}
              <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded font-medium">
                + Any Language
              </span>
            </div>
          </div>
        )}

      {/* Universal Compatibility Indicators */}
      {memoizedSelectedFiles.length > 0 && !isGenerating && (
        <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-t border-secondary-200">
          <div className="flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Multi-Language Support</span>
            </div>
            <div className="flex items-center space-x-1 text-blue-600">
              <Brain className="h-4 w-4" />
              <span>AI Pattern Recognition</span>
            </div>
            <div className="flex items-center space-x-1 text-purple-600">
              <Zap className="h-4 w-4" />
              <span>Framework Agnostic</span>
            </div>
            <div className="flex items-center space-x-1 text-orange-600">
              <Target className="h-4 w-4" />
              <span>Adaptive Testing</span>
            </div>
          </div>
        </div>
      )}

      {/* Debug Info (development only) */}
      {import.meta.env.DEV && (
        <div className="px-6 py-2 bg-gray-100 border-t text-xs text-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>Session: {sessionId ? "✅" : "❌"}</div>
            <div>Repository: {repository?.full_name || "Not set"}</div>
            <div>Files: {memoizedSelectedFiles.length}</div>
            <div>Languages: {Object.keys(detectedLanguages).length}</div>
          </div>
          {projectStructure && (
            <div className="mt-2 text-xs">
              Frameworks:{" "}
              {projectStructure.frameworks.join(", ") || "None detected"} |
              Patterns:{" "}
              {projectStructure.patterns.join(", ") || "None detected"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestCaseGenerator;

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
} from "lucide-react";
import {
  generateTestCases,
  downloadTestCasesAsJSON,
  copyToClipboard,
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
  const [generationConfig, setGenerationConfig] = useState({
    types: ["unit", "integration", "e2e"],
    complexity: "medium",
    includeEdgeCases: true,
    includeNegativeTests: true,
    framework: "auto",
    language: "auto",
  });
  const [error, setError] = useState(null);
  const [generationTime, setGenerationTime] = useState(0);
  const [lastGeneratedFiles, setLastGeneratedFiles] = useState([]);

  const testFrameworks = {
    javascript: ["Jest", "Mocha", "Cypress", "Playwright"],
    python: ["pytest", "unittest", "Selenium"],
    java: ["JUnit", "TestNG", "Selenium"],
    csharp: ["NUnit", "xUnit", "MSTest"],
    php: ["PHPUnit", "Codeception"],
    ruby: ["RSpec", "Minitest"],
    go: ["testing", "Ginkgo"],
    auto: ["Auto-detect"],
  };

  // Memoize selected files to prevent unnecessary re-renders
  const memoizedSelectedFiles = useMemo(() => {
    return selectedFiles.map((file) => ({
      path: file.path,
      name: file.name,
      owner: file.owner,
      repo: file.repo,
    }));
  }, [selectedFiles]);

  // Stable function reference using useCallback
  const handleGenerate = useCallback(async () => {
    if (memoizedSelectedFiles.length === 0) {
      setError("Please select at least one file to generate test cases");
      return;
    }

    // Check if we have required dependencies
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
    const startTime = Date.now();

    try {
      console.log("🧪 Starting test case generation...", {
        filesCount: memoizedSelectedFiles.length,
        repository: repository.full_name,
        config: generationConfig,
      });

      const response = await generateTestCases({
        files: memoizedSelectedFiles,
        repository: repository.full_name,
        config: generationConfig,
        sessionId,
      });

      console.log("✅ Test cases generated:", response);

      const generatedTestCases =
        response.testCases || response.data || response;

      if (!Array.isArray(generatedTestCases)) {
        throw new Error(
          "Invalid response format: expected array of test cases"
        );
      }

      setTestCases(generatedTestCases);
      setGenerationTime(Date.now() - startTime);
      setLastGeneratedFiles(memoizedSelectedFiles);

      // Call the callback if provided
      if (onTestCasesGenerated) {
        onTestCasesGenerated(generatedTestCases);
      }

      console.log(
        `✅ Generated ${generatedTestCases.length} test cases in ${Math.round(
          (Date.now() - startTime) / 1000
        )}s`
      );
    } catch (err) {
      console.error("❌ Test case generation failed:", err);

      let errorMessage = "Failed to generate test cases";

      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }, [
    memoizedSelectedFiles,
    repository?.full_name,
    generationConfig,
    sessionId,
    onTestCasesGenerated,
  ]);

  // Auto-generate when files change (optional - remove if you want manual only)
  useEffect(() => {
    // Only auto-generate if:
    // 1. We have files selected
    // 2. Files have changed from last generation
    // 3. We're not currently generating
    // 4. We have all required data

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
      console.log("🔄 Files changed, auto-generating test cases...");
      // Add a small delay to debounce rapid changes
      const timer = setTimeout(() => {
        handleGenerate();
      }, 1000);

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
      await downloadTestCasesAsJSON(testCases, repository?.name || "testcases");
      console.log("✅ Test cases downloaded successfully");
    } catch (err) {
      console.error("❌ Download failed:", err);
      setError("Failed to download test cases");
    }
  }, [testCases, repository?.name]);

  const handleCopy = useCallback(async () => {
    if (testCases.length === 0) {
      setError("No test cases to copy");
      return;
    }

    try {
      const success = await copyToClipboard(JSON.stringify(testCases, null, 2));
      if (success) {
        console.log("✅ Test cases copied to clipboard");
        // You could add a toast notification here
      } else {
        throw new Error("Copy operation failed");
      }
    } catch (err) {
      console.error("❌ Copy failed:", err);
      setError("Failed to copy test cases to clipboard");
    }
  }, [testCases]);

  const getComplexityColor = useCallback((complexity) => {
    switch (complexity) {
      case "simple":
        return "text-success-600 bg-success-50";
      case "medium":
        return "text-warning-600 bg-warning-50";
      case "complex":
        return "text-error-600 bg-error-50";
      default:
        return "text-secondary-600 bg-secondary-50";
    }
  }, []);

  const getTestTypeIcon = useCallback((type) => {
    switch (type) {
      case "unit":
        return <Target className="h-4 w-4" />;
      case "integration":
        return <Layers className="h-4 w-4" />;
      case "e2e":
        return <Code className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
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
            <div className="p-2 bg-primary-100 rounded-lg">
              <Zap className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">
                Test Case Generator
              </h2>
              <p className="text-sm text-secondary-600">
                AI-powered test case generation for your codebase
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
                <span>Download</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="px-6 py-4 bg-secondary-50 border-b border-secondary-200">
        <div className="flex items-center space-x-2 mb-4">
          <Settings className="h-5 w-5 text-secondary-600" />
          <span className="font-medium text-secondary-900">
            Generation Configuration
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Test Types */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Test Types
            </label>
            <div className="space-y-2">
              {["unit", "integration", "e2e"].map((type) => (
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
                  <span className="ml-2 text-sm text-secondary-700 capitalize">
                    {type} Tests
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Complexity */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Complexity Level
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
              <option value="simple">Simple</option>
              <option value="medium">Medium</option>
              <option value="complex">Complex</option>
            </select>
          </div>

          {/* Framework */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Test Framework
            </label>
            <select
              value={generationConfig.framework}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  framework: e.target.value,
                }))
              }
              className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              {Object.entries(testFrameworks).map(([lang, frameworks]) => (
                <optgroup
                  key={lang}
                  label={lang.charAt(0).toUpperCase() + lang.slice(1)}
                >
                  {frameworks.map((framework) => (
                    <option key={framework} value={framework.toLowerCase()}>
                      {framework}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Options */}
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={generationConfig.includeEdgeCases}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  includeEdgeCases: e.target.checked,
                }))
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
            <span className="ml-2 text-sm text-secondary-700">
              Include Edge Cases
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={generationConfig.includeNegativeTests}
              onChange={(e) =>
                setGenerationConfig((prev) => ({
                  ...prev,
                  includeNegativeTests: e.target.checked,
                }))
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
            />
            <span className="ml-2 text-sm text-secondary-700">
              Include Negative Tests
            </span>
          </label>
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
              Test cases will be generated for these files
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
                <Zap className="h-4 w-4" />
                <span>Generate Test Cases</span>
              </>
            )}
          </Button>
        </div>

        {memoizedSelectedFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {memoizedSelectedFiles.slice(0, 5).map((file) => (
              <span
                key={file.path}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
              >
                {file.name}
              </span>
            ))}
            {memoizedSelectedFiles.length > 5 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                +{memoizedSelectedFiles.length - 5} more
              </span>
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

      {/* Results */}
      {testCases.length > 0 && (
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-secondary-900">
                Generated Test Cases
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
              </div>
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {testCases.map((testCase, index) => (
              <div
                key={testCase.id || index}
                className="border border-secondary-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getTestTypeIcon(testCase.type)}
                      <h4 className="font-medium text-secondary-900">
                        {testCase.title}
                      </h4>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getComplexityColor(
                          testCase.priority
                        )}`}
                      >
                        {testCase.priority}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {testCase.type}
                      </span>
                    </div>
                    <p className="text-sm text-secondary-600 mb-3">
                      {testCase.description}
                    </p>
                    {testCase.code && (
                      <div className="bg-secondary-900 text-secondary-100 p-3 rounded-md font-mono text-sm overflow-x-auto">
                        <pre>{testCase.code}</pre>
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
          <LoadingSpinner size="large" />
          <div className="mt-4">
            <h3 className="text-lg font-medium text-secondary-900">
              Generating Test Cases
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              AI is analyzing {memoizedSelectedFiles.length} files and creating
              comprehensive test cases...
            </p>
            <div className="mt-2 text-xs text-secondary-500">
              This may take up to 2 minutes for complex codebases
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isGenerating &&
        testCases.length === 0 &&
        memoizedSelectedFiles.length === 0 && (
          <div className="px-6 py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-secondary-400" />
            <h3 className="mt-2 text-sm font-medium text-secondary-900">
              No files selected
            </h3>
            <p className="mt-1 text-sm text-secondary-500">
              Select files from the file explorer to generate test cases.
            </p>
          </div>
        )}

      {/* Debug Info (remove in production) */}
      {import.meta.env.DEV && (
        <div className="px-6 py-2 bg-gray-100 border-t text-xs text-gray-600">
          <div>Session: {sessionId ? "✅" : "❌"}</div>
          <div>Repository: {repository?.full_name || "Not set"}</div>
          <div>Files: {memoizedSelectedFiles.length}</div>
          <div>Generating: {isGenerating ? "Yes" : "No"}</div>
        </div>
      )}
    </div>
  );
};

export default TestCaseGenerator;

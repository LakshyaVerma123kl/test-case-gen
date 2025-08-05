// components/TestCases/TestCaseGenerator.jsx
import React, { useState, useEffect } from "react";
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
  selectedFiles,
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

  const handleGenerate = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to generate test cases");
      return;
    }

    setIsGenerating(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await generateTestCases({
        files: selectedFiles,
        repository: repository.full_name,
        config: generationConfig,
        sessionId,
      });

      setTestCases(response.testCases);
      setGenerationTime(Date.now() - startTime);
      onTestCasesGenerated?.(response.testCases);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate test cases");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadTestCasesAsJSON(testCases, repository.name);
    } catch (err) {
      setError("Failed to download test cases");
    }
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(JSON.stringify(testCases, null, 2));
      // Show success message (you could use a toast notification here)
    } catch (err) {
      setError("Failed to copy test cases");
    }
  };

  const getComplexityColor = (complexity) => {
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
  };

  const getTestTypeIcon = (type) => {
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
  };

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
              Selected Files ({selectedFiles.length})
            </h3>
            <p className="text-xs text-secondary-600 mt-1">
              Test cases will be generated for these files
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={selectedFiles.length === 0 || isGenerating}
            loading={isGenerating}
            className="flex items-center space-x-2"
          >
            <Zap className="h-4 w-4" />
            <span>
              {isGenerating ? "Generating..." : "Generate Test Cases"}
            </span>
          </Button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedFiles.slice(0, 5).map((file) => (
              <span
                key={file.path}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
              >
                {file.name}
              </span>
            ))}
            {selectedFiles.length > 5 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                +{selectedFiles.length - 5} more
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
              AI is analyzing your code and creating comprehensive test cases...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isGenerating &&
        testCases.length === 0 &&
        selectedFiles.length === 0 && (
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
    </div>
  );
};

export default TestCaseGenerator;

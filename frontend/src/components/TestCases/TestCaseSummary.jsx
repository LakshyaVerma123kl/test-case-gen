// components/TestCases/TestCaseSummary.jsx
import React, { useState, useEffect } from "react";
import {
  Zap,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Target,
  Layers,
  Code,
  TrendingUp,
  PieChart,
  BarChart3,
  Download,
  Share2,
} from "lucide-react";
import {
  generateTestCaseSummary,
  exportSummaryReport,
  getTestCaseMetrics,
} from "../../services/api";
import Button from "../UI/Button";
import LoadingSpinner from "../UI/LoadingSpinner";

const TestCaseSummary = ({
  testCases = [],
  repository,
  selectedFiles = [],
  sessionId,
}) => {
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(
    new Set(["overview"])
  );

  useEffect(() => {
    if (testCases.length > 0) {
      generateSummary();
      calculateMetrics();
    }
  }, [testCases]);

  const generateSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const summaryData = await generateTestCaseSummary({
        testCases,
        repository: repository?.full_name,
        files: selectedFiles,
        sessionId,
      });
      setSummary(summaryData);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const metrics = {
      total: testCases.length,
      byType: {},
      byPriority: {},
      byCoverage: {},
      byComplexity: {},
      estimatedTime: 0,
    };

    testCases.forEach((tc) => {
      // Count by type
      metrics.byType[tc.type] = (metrics.byType[tc.type] || 0) + 1;

      // Count by priority
      metrics.byPriority[tc.priority] =
        (metrics.byPriority[tc.priority] || 0) + 1;

      // Estimate execution time (in minutes)
      const timeEstimate = getTimeEstimate(tc.type, tc.priority);
      metrics.estimatedTime += timeEstimate;
    });

    // Calculate coverage
    metrics.byCoverage = {
      unit: Math.round(((metrics.byType.unit || 0) / metrics.total) * 100),
      integration: Math.round(
        ((metrics.byType.integration || 0) / metrics.total) * 100
      ),
      e2e: Math.round(((metrics.byType.e2e || 0) / metrics.total) * 100),
    };

    setMetrics(metrics);
  };

  const getTimeEstimate = (type, priority) => {
    const baseTime = {
      unit: 5,
      integration: 15,
      e2e: 30,
    };

    const priorityMultiplier = {
      low: 0.8,
      medium: 1.0,
      high: 1.5,
      critical: 2.0,
    };

    return (baseTime[type] || 10) * (priorityMultiplier[priority] || 1);
  };

  const toggleSection = (section) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleExport = async () => {
    try {
      await exportSummaryReport({
        testCases,
        summary,
        metrics,
        repository: repository?.name || "project",
      });
    } catch (err) {
      setError("Failed to export report");
    }
  };

  const getTypeIcon = (type) => {
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "low":
        return "text-blue-600 bg-blue-50";
      case "medium":
        return "text-yellow-600 bg-yellow-50";
      case "high":
        return "text-orange-600 bg-orange-50";
      case "critical":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (testCases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
        <div className="px-6 py-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            No Test Cases Generated
          </h3>
          <p className="mt-1 text-sm text-secondary-500">
            Generate test cases to see the summary and metrics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <PieChart className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">
                Test Case Summary
              </h2>
              <p className="text-sm text-secondary-600">
                Analysis and insights for generated test cases
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generateSummary}
              disabled={loading}
              className="flex items-center space-x-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-4 bg-error-50 border-b border-error-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-error-600" />
            <span className="text-sm text-error-700">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-8 text-center">
          <LoadingSpinner size="large" />
          <div className="mt-4">
            <h3 className="text-lg font-medium text-secondary-900">
              Generating Summary
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              Analyzing test cases and calculating metrics...
            </p>
          </div>
        </div>
      )}

      {/* Overview Section */}
      {metrics && (
        <div className="p-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("overview")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("overview") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900">Overview</h3>
            </div>
          </div>

          {expandedSections.has("overview") && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Test Cases */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Total Test Cases
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {metrics.total}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              {/* Estimated Time */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Est. Execution Time
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {Math.round(metrics.estimatedTime)}m
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
              </div>

              {/* Coverage Score */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">
                      Coverage Score
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {Math.round(
                        (metrics.byCoverage.unit +
                          metrics.byCoverage.integration +
                          metrics.byCoverage.e2e) /
                          3
                      )}
                      %
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              {/* Quality Score */}
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">
                      Quality Score
                    </p>
                    <p className="text-2xl font-bold text-orange-900">
                      {Math.round(85 + (metrics.byPriority.high || 0) * 2)}%
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-orange-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Type Distribution */}
      {metrics && (
        <div className="px-6 pb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("distribution")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("distribution") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900">
                Test Distribution
              </h3>
            </div>
          </div>

          {expandedSections.has("distribution") && (
            <div className="mt-4 space-y-4">
              {/* By Type */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  By Test Type
                </h4>
                <div className="space-y-2">
                  {Object.entries(metrics.byType).map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(type)}
                        <span className="text-sm text-gray-700 capitalize">
                          {type} Tests
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full"
                            style={{
                              width: `${(count / metrics.total) * 100}%`,
                            }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-8">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Priority */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  By Priority
                </h4>
                <div className="space-y-2">
                  {Object.entries(metrics.byPriority).map(
                    ([priority, count]) => (
                      <div
                        key={priority}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                              priority
                            )}`}
                          >
                            {priority}
                          </span>
                          <span className="text-sm text-gray-700 capitalize">
                            {priority} Priority
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-secondary-600 h-2 rounded-full"
                              style={{
                                width: `${(count / metrics.total) * 100}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">
                            {count}
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Summary */}
      {summary && (
        <div className="px-6 pb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("ai-summary")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("ai-summary") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900">AI Analysis</h3>
            </div>
          </div>

          {expandedSections.has("ai-summary") && (
            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="prose prose-sm max-w-none">
                <div className="space-y-3">
                  {summary.insights && (
                    <div>
                      <h5 className="font-medium text-gray-900">
                        Key Insights
                      </h5>
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                        {summary.insights.map((insight, index) => (
                          <li key={index}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.recommendations && (
                    <div>
                      <h5 className="font-medium text-gray-900">
                        Recommendations
                      </h5>
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                        {summary.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.coverage && (
                    <div>
                      <h5 className="font-medium text-gray-900">
                        Coverage Analysis
                      </h5>
                      <p className="text-sm text-gray-700 mt-1">
                        {summary.coverage}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestCaseSummary;

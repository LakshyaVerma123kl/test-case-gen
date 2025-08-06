import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Brain,
  BarChart3,
  PieChart,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Target,
  Layers,
  Code,
  Download,
  Share2,
  Globe,
  Database,
  Zap,
  Shield,
  Eye,
  Info,
  Award,
  Activity,
  FileText,
  Cpu,
} from "lucide-react";
import {
  generateTestCaseSummary,
  exportSummaryReport,
  getTestCaseMetrics,
  getLanguageIcon,
  estimateGenerationTime,
} from "../../services/api";
import Button from "../UI/Button";
import LoadingSpinner from "../UI/LoadingSpinner";

const TestCaseSummary = ({
  testCases = [],
  repository,
  selectedFiles = [],
  sessionId,
  generationConfig = {},
}) => {
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState(
    new Set(["overview", "languages"])
  );
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Compute comprehensive metrics from test cases
  const comprehensiveMetrics = useMemo(() => {
    if (testCases.length === 0) return null;

    const metrics = {
      total: testCases.length,
      byLanguage: {},
      byType: {},
      byPriority: {},
      byRisk: { low: 0, medium: 0, high: 0 },
      byFramework: {},
      byComplexity: {},
      estimatedTime: 0,
      maintenanceScore: 0,
      coverageEstimate: 0,
      qualityScore: 0,
      universalPatterns: 0,
      fallbackTests: 0,
      languageCoverage: new Set(),
      frameworkCoverage: new Set(),
      testPatterns: new Set(),
    };

    testCases.forEach((tc) => {
      // Count by language
      const lang = tc.language || tc.adaptedForLanguage || "unknown";
      metrics.byLanguage[lang] = (metrics.byLanguage[lang] || 0) + 1;
      metrics.languageCoverage.add(lang);

      // Count by type
      metrics.byType[tc.type] = (metrics.byType[tc.type] || 0) + 1;
      metrics.testPatterns.add(tc.type);

      // Count by priority
      const priority = tc.priority || "medium";
      metrics.byPriority[priority] = (metrics.byPriority[priority] || 0) + 1;

      // Count by risk level
      const risk = tc.riskLevel || "low";
      metrics.byRisk[risk] = (metrics.byRisk[risk] || 0) + 1;

      // Count by framework
      const framework = tc.framework || "generic";
      metrics.byFramework[framework] =
        (metrics.byFramework[framework] || 0) + 1;
      metrics.frameworkCoverage.add(framework);

      // Count by complexity
      const complexity = tc.complexity || "medium";
      metrics.byComplexity[complexity] =
        (metrics.byComplexity[complexity] || 0) + 1;

      // Accumulate time estimates
      metrics.estimatedTime +=
        tc.estimatedTime || tc.estimatedExecutionTime || 30;

      // Track maintenance score
      metrics.maintenanceScore += tc.maintenanceScore || 70;

      // Count special patterns
      if (tc.universalPattern) metrics.universalPatterns++;
      if (tc.fallback) metrics.fallbackTests++;
    });

    // Calculate averages and scores
    metrics.maintenanceScore = Math.round(
      metrics.maintenanceScore / testCases.length
    );
    metrics.coverageEstimate = Math.min(
      95,
      Math.max(60, testCases.length * 1.5)
    );

    // Quality score based on various factors
    let qualityScore = 70; // Base score
    qualityScore += Math.min(20, metrics.universalPatterns * 2); // Universal patterns bonus
    qualityScore += Math.min(10, metrics.languageCoverage.size * 2); // Multi-language bonus
    qualityScore -= metrics.fallbackTests * 2; // Penalty for fallbacks
    qualityScore += metrics.byRisk.high * 3; // Bonus for high-risk test coverage
    metrics.qualityScore = Math.max(0, Math.min(100, qualityScore));

    // Convert sets to arrays for easier handling
    metrics.languageCoverage = Array.from(metrics.languageCoverage);
    metrics.frameworkCoverage = Array.from(metrics.frameworkCoverage);
    metrics.testPatterns = Array.from(metrics.testPatterns);

    return metrics;
  }, [testCases]);

  // Generate AI summary with enhanced analysis
  const generateSummary = useCallback(async () => {
    if (!testCases.length) return;

    setLoading(true);
    setError(null);

    try {
      const enhancedPayload = {
        testCases,
        repository: repository?.full_name,
        files: selectedFiles,
        metrics: comprehensiveMetrics,
        config: generationConfig,
        universalMode: true,
        sessionId,
      };

      const summaryData = await generateTestCaseSummary(enhancedPayload);

      // Enhance summary with computed metrics
      const enhancedSummary = {
        ...summaryData,
        computedMetrics: comprehensiveMetrics,
        analysisTimestamp: new Date().toISOString(),
        universalAnalysis: true,
      };

      setSummary(enhancedSummary);
      setAnalysisComplete(true);
    } catch (err) {
      console.error("Summary generation failed:", err);

      // Generate fallback summary
      const fallbackSummary = generateFallbackSummary();
      setSummary(fallbackSummary);
      setError("AI analysis unavailable, using local analysis");
    } finally {
      setLoading(false);
    }
  }, [
    testCases,
    repository?.full_name,
    selectedFiles,
    comprehensiveMetrics,
    generationConfig,
    sessionId,
  ]);

  // Generate fallback summary when AI is unavailable
  const generateFallbackSummary = useCallback(() => {
    if (!comprehensiveMetrics) return null;

    const insights = [];
    const recommendations = [];

    // Generate insights based on metrics
    if (comprehensiveMetrics.languageCoverage.length > 1) {
      insights.push(
        `Multi-language project detected with ${comprehensiveMetrics.languageCoverage.length} programming languages`
      );
    }

    if (
      comprehensiveMetrics.universalPatterns >
      comprehensiveMetrics.total * 0.8
    ) {
      insights.push(
        "High coverage of universal test patterns ensures broad compatibility"
      );
    }

    if (comprehensiveMetrics.fallbackTests > 0) {
      insights.push(
        `${comprehensiveMetrics.fallbackTests} tests generated using fallback templates`
      );
    }

    if (comprehensiveMetrics.byRisk.high > 0) {
      insights.push(
        `${comprehensiveMetrics.byRisk.high} high-risk tests identified for critical functionality`
      );
    }

    // Generate recommendations
    if (comprehensiveMetrics.fallbackTests > comprehensiveMetrics.total * 0.3) {
      recommendations.push(
        "Consider reviewing fallback tests and enhancing them with specific test logic"
      );
    }

    if (comprehensiveMetrics.byType.unit < comprehensiveMetrics.total * 0.5) {
      recommendations.push(
        "Increase unit test coverage for better isolation and faster execution"
      );
    }

    if (comprehensiveMetrics.maintenanceScore < 75) {
      recommendations.push(
        "Focus on improving test maintainability through better documentation and structure"
      );
    }

    if (comprehensiveMetrics.byRisk.low > comprehensiveMetrics.total * 0.8) {
      recommendations.push(
        "Consider adding more comprehensive tests for critical paths"
      );
    }

    return {
      insights,
      recommendations,
      coverage: `Estimated ${comprehensiveMetrics.coverageEstimate}% coverage across ${comprehensiveMetrics.languageCoverage.length} languages`,
      qualityAssessment: getQualityAssessment(
        comprehensiveMetrics.qualityScore
      ),
      fallback: true,
      computedMetrics: comprehensiveMetrics,
    };
  }, [comprehensiveMetrics]);

  const getQualityAssessment = (score) => {
    if (score >= 90)
      return "Excellent - High-quality test suite with comprehensive coverage";
    if (score >= 80)
      return "Good - Well-structured tests with room for minor improvements";
    if (score >= 70)
      return "Fair - Decent test coverage but could benefit from enhancement";
    if (score >= 60)
      return "Needs Improvement - Basic testing in place but requires attention";
    return "Poor - Significant improvements needed in test quality and coverage";
  };

  // Auto-generate summary when test cases change
  useEffect(() => {
    if (testCases.length > 0 && !analysisComplete) {
      const timer = setTimeout(() => {
        generateSummary();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [testCases, generateSummary, analysisComplete]);

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
      const exportData = {
        testCases,
        summary: summary || generateFallbackSummary(),
        metrics: comprehensiveMetrics,
        repository: repository?.name || "project",
        universalMode: true,
        generatedAt: new Date().toISOString(),
      };

      await exportSummaryReport(exportData);
      console.log("✅ Universal test summary exported");
    } catch (err) {
      setError("Failed to export report");
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      unit: <Target className="h-4 w-4" />,
      integration: <Layers className="h-4 w-4" />,
      e2e: <Code className="h-4 w-4" />,
      performance: <Cpu className="h-4 w-4" />,
      security: <Shield className="h-4 w-4" />,
      api: <Globe className="h-4 w-4" />,
      database: <Database className="h-4 w-4" />,
      visual: <Eye className="h-4 w-4" />,
      accessibility: <Info className="h-4 w-4" />,
    };
    return icons[type] || <FileText className="h-4 w-4" />;
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case "low":
        return "text-green-600 bg-green-50 border-green-200";
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "high":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getQualityColor = (score) => {
    if (score >= 90) return "text-green-600 bg-green-100";
    if (score >= 80) return "text-blue-600 bg-blue-100";
    if (score >= 70) return "text-yellow-600 bg-yellow-100";
    if (score >= 60) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  if (testCases.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
        <div className="px-6 py-8 text-center">
          <Brain className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            No Universal Test Cases Generated
          </h3>
          <p className="mt-1 text-sm text-secondary-500">
            Generate test cases using the Universal Test Generator to see
            comprehensive analysis.
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
            <div className="p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">
                Universal Test Analysis
              </h2>
              <p className="text-sm text-secondary-600">
                Comprehensive insights for multi-language test suites
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
        <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm text-yellow-700">{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="px-6 py-8 text-center">
          <LoadingSpinner size="large" />
          <div className="mt-4">
            <h3 className="text-lg font-medium text-secondary-900">
              Analyzing Universal Test Suite
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              Computing metrics across multiple languages and frameworks...
            </p>
          </div>
        </div>
      )}

      {/* Overview Section */}
      {comprehensiveMetrics && (
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
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                Overview Metrics
              </h3>
            </div>
          </div>

          {expandedSections.has("overview") && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Test Cases */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Total Tests
                    </p>
                    <p className="text-2xl font-bold text-blue-900">
                      {comprehensiveMetrics.total}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      Universal: {comprehensiveMetrics.universalPatterns}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              {/* Quality Score */}
              <div
                className={`p-4 rounded-lg border ${getQualityColor(
                  comprehensiveMetrics.qualityScore
                )}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Quality Score</p>
                    <p className="text-2xl font-bold">
                      {comprehensiveMetrics.qualityScore}%
                    </p>
                    <p className="text-xs mt-1">
                      Maintenance: {comprehensiveMetrics.maintenanceScore}%
                    </p>
                  </div>
                  <Award className="h-8 w-8" />
                </div>
              </div>

              {/* Language Coverage */}
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">
                      Languages
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {comprehensiveMetrics.languageCoverage.length}
                    </p>
                    <p className="text-xs text-purple-700 mt-1">
                      Multi-language support
                    </p>
                  </div>
                  <Brain className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              {/* Execution Time */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Est. Runtime
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {Math.round(comprehensiveMetrics.estimatedTime / 60)}m
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Coverage: {comprehensiveMetrics.coverageEstimate}%
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-500" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Language Distribution */}
      {comprehensiveMetrics && (
        <div className="px-6 pb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("languages")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("languages") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Globe className="h-5 w-5 mr-2 text-green-600" />
                Language & Framework Analysis
              </h3>
            </div>
          </div>

          {expandedSections.has("languages") && (
            <div className="mt-4 space-y-6">
              {/* Language Distribution */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Test Distribution by Language
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {Object.entries(comprehensiveMetrics.byLanguage)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([language, count]) => (
                        <div
                          key={language}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">
                              {getLanguageIcon(language)}
                            </span>
                            <span className="text-sm font-medium text-gray-700 capitalize">
                              {language}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${
                                    (count / comprehensiveMetrics.total) * 100
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-bold text-gray-900 w-8">
                              {count}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Framework Distribution */}
                  <div className="space-y-3">
                    <h5 className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      Testing Frameworks
                    </h5>
                    {Object.entries(comprehensiveMetrics.byFramework)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([framework, count]) => (
                        <div
                          key={framework}
                          className="flex items-center justify-between p-2 bg-blue-50 rounded"
                        >
                          <span className="text-xs text-blue-700 font-medium">
                            {framework}
                          </span>
                          <span className="text-xs font-bold text-blue-900">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Test Type Distribution */}
      {comprehensiveMetrics && (
        <div className="px-6 pb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("types")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("types") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2 text-orange-600" />
                Test Type & Risk Analysis
              </h3>
            </div>
          </div>

          {expandedSections.has("types") && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Types */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Test Types
                </h4>
                <div className="space-y-2">
                  {Object.entries(comprehensiveMetrics.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <div className="flex items-center space-x-2">
                          {getTypeIcon(type)}
                          <span className="text-sm text-gray-700 capitalize">
                            {type}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{
                                width: `${
                                  (count / comprehensiveMetrics.total) * 100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-6">
                            {count}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Risk Analysis */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Risk Distribution
                </h4>
                <div className="space-y-3">
                  {Object.entries(comprehensiveMetrics.byRisk).map(
                    ([risk, count]) => (
                      <div
                        key={risk}
                        className={`p-3 rounded-lg border ${getRiskColor(
                          risk
                        )}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium capitalize">
                              {risk} Risk
                            </span>
                          </div>
                          <span className="text-lg font-bold">{count}</span>
                        </div>
                        <div className="mt-2 text-xs opacity-75">
                          {Math.round(
                            (count / comprehensiveMetrics.total) * 100
                          )}
                          % of total tests
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

      {/* AI Analysis Results */}
      {(summary || comprehensiveMetrics) && (
        <div className="px-6 pb-6">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection("ai-analysis")}
          >
            <div className="flex items-center space-x-2">
              {expandedSections.has("ai-analysis") ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <Brain className="h-5 w-5 mr-2 text-purple-600" />
                AI Analysis & Recommendations
                {summary?.fallback && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                    Local Analysis
                  </span>
                )}
              </h3>
            </div>
          </div>

          {expandedSections.has("ai-analysis") && (
            <div className="mt-4 space-y-4">
              {/* Key Insights */}
              {(summary?.insights || []).length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h5 className="font-medium text-blue-900 flex items-center mb-3">
                    <Zap className="h-4 w-4 mr-2" />
                    Key Insights
                  </h5>
                  <ul className="space-y-2">
                    {summary.insights.map((insight, index) => (
                      <li
                        key={index}
                        className="text-sm text-blue-700 flex items-start"
                      >
                        <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {(summary?.recommendations || []).length > 0 && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h5 className="font-medium text-green-900 flex items-center mb-3">
                    <Target className="h-4 w-4 mr-2" />
                    Recommendations
                  </h5>
                  <ul className="space-y-2">
                    {summary.recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="text-sm text-green-700 flex items-start"
                      >
                        <TrendingUp className="h-4 w-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Coverage Analysis */}
              {summary?.coverage && (
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h5 className="font-medium text-purple-900 flex items-center mb-2">
                    <PieChart className="h-4 w-4 mr-2" />
                    Coverage Assessment
                  </h5>
                  <p className="text-sm text-purple-700">{summary.coverage}</p>
                </div>
              )}

              {/* Quality Assessment */}
              {summary?.qualityAssessment && (
                <div
                  className={`rounded-lg p-4 border ${getQualityColor(
                    comprehensiveMetrics?.qualityScore || 70
                  )}`}
                >
                  <h5 className="font-medium flex items-center mb-2">
                    <Award className="h-4 w-4 mr-2" />
                    Quality Assessment
                  </h5>
                  <p className="text-sm">{summary.qualityAssessment}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Universal Compatibility Badge */}
      {comprehensiveMetrics && comprehensiveMetrics.universalPatterns > 0 && (
        <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-blue-50 border-t border-secondary-200">
          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>
                Universal Patterns: {comprehensiveMetrics.universalPatterns}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-blue-600">
              <Globe className="h-4 w-4" />
              <span>
                Languages: {comprehensiveMetrics.languageCoverage.length}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-purple-600">
              <Brain className="h-4 w-4" />
              <span>AI-Generated Analysis</span>
            </div>
            {comprehensiveMetrics.fallbackTests > 0 && (
              <div className="flex items-center space-x-2 text-yellow-600">
                <Info className="h-4 w-4" />
                <span>
                  Fallback Tests: {comprehensiveMetrics.fallbackTests}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestCaseSummary;

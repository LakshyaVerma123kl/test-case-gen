import React, { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  Zap,
  GitPullRequest,
  CheckCircle,
} from "lucide-react";

// Components
import RepoList from "../Repository/RepoList";
import FileExplorer from "../Repository/FileExplorer";
import TestCaseSummary from "../TestCases/TestCaseSummary";
import TestCaseGenerator from "../TestCases/TestCaseGenerator";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";

// Services
import { getUserRepositories } from "../../services/api";

const Dashboard = ({ user, sessionId }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [testSummaries, setTestSummaries] = useState(null);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const steps = [
    {
      id: 1,
      title: "Select Repository",
      icon: Folder,
      description: "Choose a repository to analyze",
    },
    {
      id: 2,
      title: "Select Files",
      icon: FileText,
      description: "Pick files for test generation",
    },
    {
      id: 3,
      title: "Generate Test Cases",
      icon: Zap,
      description: "AI-powered test case creation",
    },
    {
      id: 4,
      title: "Review & Create PR",
      icon: GitPullRequest,
      description: "Review and create pull request",
    },
  ];

  useEffect(() => {
    loadRepositories();
  }, [sessionId]);

  const loadRepositories = async () => {
    try {
      setLoading(true);
      const response = await getUserRepositories(sessionId);
      if (response.success) {
        setRepositories(response.repos);
      } else {
        setError("Failed to load repositories");
      }
    } catch (error) {
      console.error("Error loading repositories:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRepoSelect = (repo) => {
    setSelectedRepo(repo);
    setSelectedFiles([]);
    setTestSummaries(null);
    setGeneratedTests([]);
    setCurrentStep(2);
  };

  const handleFilesSelect = (files) => {
    setSelectedFiles(files);
    if (files.length > 0) {
      setCurrentStep(3);
    }
  };

  const handleTestSummariesGenerated = (summaries) => {
    setTestSummaries(summaries);
  };

  const handleTestCodeGenerated = (testData) => {
    setGeneratedTests((prev) => [...prev, testData]);
    setCurrentStep(4);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedRepo(null);
    setSelectedFiles([]);
    setTestSummaries(null);
    setGeneratedTests([]);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-secondary-600">
            Loading your repositories...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-error-50 border border-error-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-error-800 mb-4">{error}</p>
          <Button onClick={loadRepositories} variant="error">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 mb-2">
          Welcome back, {user.name || user.login}! 👋
        </h1>
        <p className="text-secondary-600">
          Let's generate some comprehensive test cases for your code
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isUpcoming = step.id > currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                      isCompleted
                        ? "bg-success-600 border-success-600 text-white"
                        : isActive
                        ? "bg-primary-600 border-primary-600 text-white"
                        : "bg-secondary-100 border-secondary-300 text-secondary-400"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <step.icon className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <p
                      className={`text-sm font-medium ${
                        isActive
                          ? "text-primary-600"
                          : isCompleted
                          ? "text-success-600"
                          : "text-secondary-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-xs text-secondary-400 max-w-24">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-4 ${
                      step.id < currentStep
                        ? "bg-success-600"
                        : "bg-secondary-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-soft p-6">
        {currentStep === 1 && (
          <RepoList
            repositories={repositories}
            onRepoSelect={handleRepoSelect}
            selectedRepo={selectedRepo}
          />
        )}

        {currentStep === 2 && selectedRepo && (
          <FileExplorer
            repository={selectedRepo}
            sessionId={sessionId}
            onFilesSelect={handleFilesSelect}
            selectedFiles={selectedFiles}
          />
        )}

        {currentStep === 3 && selectedFiles.length > 0 && (
          <TestCaseSummary
            files={selectedFiles}
            repository={selectedRepo}
            sessionId={sessionId}
            onSummariesGenerated={handleTestSummariesGenerated}
            testSummaries={testSummaries}
          />
        )}

        {currentStep === 4 && testSummaries && (
          <TestCaseGenerator
            testSummaries={testSummaries}
            repository={selectedRepo}
            sessionId={sessionId}
            onTestGenerated={handleTestCodeGenerated}
            generatedTests={generatedTests}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex justify-between">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={currentStep === 1}
        >
          Start Over
        </Button>

        <div className="flex space-x-3">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            >
              Previous Step
            </Button>
          )}
        </div>
      </div>

      {/* Stats Card */}
      {repositories.length > 0 && (
        <div className="mt-8 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary-600">
                {repositories.length}
              </p>
              <p className="text-sm text-secondary-600">
                Repositories Available
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-600">
                {selectedFiles.length}
              </p>
              <p className="text-sm text-secondary-600">Files Selected</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success-600">
                {generatedTests.length}
              </p>
              <p className="text-sm text-secondary-600">Tests Generated</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

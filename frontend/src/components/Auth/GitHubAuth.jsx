import React, { useState } from "react";
import {
  Github,
  Key,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { authenticateGitHub } from "../../services/api";
import LoadingSpinner from "../UI/LoadingSpinner";
import Button from "../UI/Button";

const GitHubAuth = ({ onAuthSuccess, onAuthError, error }) => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token.trim()) {
      onAuthError("Please enter your GitHub token");
      return;
    }

    setLoading(true);

    try {
      const response = await authenticateGitHub(token.trim());

      if (response.success) {
        onAuthSuccess(response.user, response.sessionId);
        setToken(""); // Clear token from state for security
      } else {
        onAuthError(response.error || "Authentication failed");
      }
    } catch (error) {
      onAuthError(error.message || "Failed to authenticate with GitHub");
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (e) => {
    setToken(e.target.value);
    if (error) {
      onAuthError(null); // Clear error when user starts typing
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-soft p-6">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 bg-secondary-100 rounded-full mx-auto mb-4">
            <Github className="w-8 h-8 text-secondary-700" />
          </div>
          <h2 className="text-xl font-semibold text-secondary-900">
            Connect to GitHub
          </h2>
          <p className="text-sm text-secondary-600 mt-1">
            Enter your GitHub Personal Access Token to get started
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="github-token"
              className="block text-sm font-medium text-secondary-700 mb-2"
            >
              GitHub Personal Access Token
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-4 w-4 text-secondary-400" />
              </div>
              <input
                id="github-token"
                type="password"
                value={token}
                onChange={handleTokenChange}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className={`block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
                  error
                    ? "border-error-300 bg-error-50"
                    : "border-secondary-300 bg-white"
                }`}
                disabled={loading}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="mt-2 flex items-center text-sm text-error-600">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full"
            variant="primary"
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" className="mr-2" />
                Authenticating...
              </>
            ) : (
              <>
                <Github className="w-4 h-4 mr-2" />
                Connect GitHub
              </>
            )}
          </Button>
        </form>

        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full text-left text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            {showInstructions ? "▼" : "▶"} How to get a GitHub token?
          </button>

          {showInstructions && (
            <div className="mt-3 p-4 bg-primary-50 rounded-md text-sm text-secondary-700 animate-slide-down">
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  Go to{" "}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center"
                  >
                    GitHub Settings → Personal Access Tokens
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </li>
                <li>
                  Click "Generate new token" → "Generate new token (classic)"
                </li>
                <li>
                  Give it a descriptive name (e.g., "Test Case Generator")
                </li>
                <li>
                  Select the following scopes:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>
                      <code className="bg-white px-1 rounded">repo</code> - Full
                      repository access
                    </li>
                    <li>
                      <code className="bg-white px-1 rounded">user:email</code>{" "}
                      - Access user email
                    </li>
                  </ul>
                </li>
                <li>Click "Generate token" and copy the token</li>
                <li>Paste the token above and click "Connect GitHub"</li>
              </ol>

              <div className="mt-3 p-2 bg-warning-100 rounded border-l-4 border-warning-400">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-warning-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-xs text-warning-800">
                    <strong>Security Note:</strong> Keep your token secure and
                    never share it publicly. This application stores the token
                    temporarily in your browser session only.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-secondary-200">
          <div className="flex items-center justify-center text-xs text-secondary-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            <span>Your token is encrypted and secure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GitHubAuth;

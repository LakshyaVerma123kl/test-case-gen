import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./App.css";

// Components
import Header from "./components/UI/Header";
import GitHubAuth from "./components/Auth/GitHubAuth";
import Dashboard from "./components/Dashboard/Dashboard";
import LoadingSpinner from "./components/UI/LoadingSpinner";

// Services
import { validateSession } from "./services/api";

function App() {
  const [user, setUser] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on app load
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const storedSessionId = localStorage.getItem("github_session_id");
        if (storedSessionId) {
          const response = await validateSession(storedSessionId);
          if (response.success) {
            setUser(response.user);
            setSessionId(storedSessionId);
          } else {
            localStorage.removeItem("github_session_id");
          }
        }
      } catch (error) {
        console.error("Session validation error:", error);
        localStorage.removeItem("github_session_id");
      } finally {
        setLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  const handleAuthSuccess = (userData, session) => {
    setUser(userData);
    setSessionId(session);
    localStorage.setItem("github_session_id", session);
    setError(null);
  };

  const handleAuthError = (errorMessage) => {
    setError(errorMessage);
    setUser(null);
    setSessionId(null);
    localStorage.removeItem("github_session_id");
  };

  const handleLogout = () => {
    setUser(null);
    setSessionId(null);
    localStorage.removeItem("github_session_id");
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-secondary-600 font-medium">
            Loading Test Case Generator...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100">
        <Header user={user} onLogout={handleLogout} />

        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route
              path="/"
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <div className="flex items-center justify-center min-h-[80vh]">
                    <div className="w-full max-w-md">
                      <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-secondary-900 mb-4">
                          🚀 Test Case Generator
                        </h1>
                        <p className="text-lg text-secondary-600 mb-8">
                          Generate comprehensive test cases for your GitHub
                          repositories using AI
                        </p>
                      </div>

                      <GitHubAuth
                        onAuthSuccess={handleAuthSuccess}
                        onAuthError={handleAuthError}
                        error={error}
                      />

                      <div className="mt-8 text-center">
                        <div className="bg-white rounded-lg p-6 shadow-soft">
                          <h3 className="text-lg font-semibold text-secondary-900 mb-3">
                            ✨ Features
                          </h3>
                          <ul className="text-sm text-secondary-600 space-y-2">
                            <li>🔗 Seamless GitHub integration</li>
                            <li>🤖 AI-powered test case generation</li>
                            <li>📝 Multiple test framework support</li>
                            <li>🔀 Automatic PR creation</li>
                            <li>🎨 Clean and intuitive UI</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
            />

            <Route
              path="/dashboard"
              element={
                user ? (
                  <Dashboard user={user} sessionId={sessionId} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="bg-white border-t border-secondary-200 py-6 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p className="text-secondary-600">
              Built with ❤️ for Workik AI • Powered by Gemini AI & GitHub API
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

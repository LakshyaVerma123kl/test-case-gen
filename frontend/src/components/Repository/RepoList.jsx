import React, { useState } from "react";
import {
  Search,
  Folder,
  Lock,
  Calendar,
  ExternalLink,
  Star,
  AlertCircle,
} from "lucide-react";
import { getLanguageIcon } from "../../services/api";
import Button from "../UI/Button";

const RepoList = ({
  repositories,
  onRepoSelect,
  selectedRepo,
  loading,
  error,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("updated");
  const [filterLanguage, setFilterLanguage] = useState("all");

  // Debug logging - only in development
  if (import.meta.env.DEV) {
    console.log("🔍 RepoList Debug Info:");
    console.log("repositories prop:", repositories);
    console.log("repositories type:", typeof repositories);
  }

  // Normalize repositories data
  let safeRepositories = [];

  try {
    if (Array.isArray(repositories)) {
      safeRepositories = repositories;
    } else if (repositories && Array.isArray(repositories.repositories)) {
      safeRepositories = repositories.repositories;
    } else if (repositories && typeof repositories === "object") {
      // Look for any array property that might contain repositories
      const possibleArrays = Object.values(repositories).filter(Array.isArray);
      safeRepositories = possibleArrays.length > 0 ? possibleArrays[0] : [];
    }
  } catch (err) {
    console.error("Error processing repositories:", err);
    safeRepositories = [];
  }

  // Get unique languages from repositories
  const languages = [
    ...new Set(safeRepositories.map((repo) => repo.language).filter(Boolean)),
  ].sort();

  // Filter and sort repositories
  const filteredRepos = safeRepositories
    .filter((repo) => {
      const matchesSearch =
        repo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (repo.description &&
          repo.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesLanguage =
        filterLanguage === "all" || repo.language === filterLanguage;
      return matchesSearch && matchesLanguage;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "language":
          return (a.language || "").localeCompare(b.language || "");
        case "updated":
        default:
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      }
    });

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (err) {
      return "Unknown";
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-2">
            Loading Repositories...
          </h2>
          <p className="text-secondary-600">
            Fetching your repositories from GitHub...
          </p>
        </div>
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-secondary-900 mb-2">
            Failed to Load Repositories
          </h2>
          <p className="text-secondary-600">
            There was an error loading your repositories.
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <h3 className="font-medium text-red-900">Error Details</h3>
          </div>
          <p className="text-red-800 mb-4">{error}</p>
          <div className="text-sm text-red-700">
            <p>
              <strong>Possible solutions:</strong>
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Check your internet connection</li>
              <li>
                Verify your GitHub token is valid and has repository permissions
              </li>
              <li>Try refreshing the page</li>
              <li>Check if GitHub services are operational</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-secondary-900 mb-2">
          Select a Repository
        </h2>
        <p className="text-secondary-600">
          Choose a repository to analyze and generate test cases for its code
          files.
        </p>
      </div>

      {/* Only show debug info in development mode */}
      {import.meta.env.DEV && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Debug Information</h3>
          </div>
          <div className="text-sm text-blue-800 space-y-1">
            <p>• Repositories prop type: {typeof repositories}</p>
            <p>• Is array: {Array.isArray(repositories) ? "Yes" : "No"}</p>
            <p>• Safe repositories count: {safeRepositories.length}</p>
            <p>• Filtered repositories count: {filteredRepos.length}</p>
            <p>• Search term: "{searchTerm}"</p>
            <p>• Filter language: {filterLanguage}</p>
            <p>• Sort by: {sortBy}</p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-secondary-400" />
          </div>
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="updated">Last Updated</option>
            <option value="name">Name</option>
            <option value="language">Language</option>
          </select>

          <select
            value={filterLanguage}
            onChange={(e) => setFilterLanguage(e.target.value)}
            className="px-3 py-2 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Languages</option>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Repository Grid */}
      {filteredRepos.length === 0 ? (
        <div className="text-center py-12">
          <Folder className="mx-auto h-12 w-12 text-secondary-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            No repositories found
          </h3>
          <p className="mt-1 text-sm text-secondary-500">
            {safeRepositories.length === 0
              ? "No repositories were loaded from GitHub"
              : searchTerm
              ? "Try adjusting your search terms"
              : "No repositories match the current filters"}
          </p>
          {safeRepositories.length === 0 && (
            <p className="mt-2 text-xs text-red-600">
              This could indicate an authentication or API issue.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className={`border rounded-lg p-4 transition-all duration-200 cursor-pointer hover:shadow-md ${
                selectedRepo?.id === repo.id
                  ? "border-primary-500 bg-primary-50 shadow-md"
                  : "border-secondary-200 bg-white hover:border-secondary-300"
              }`}
              onClick={() => onRepoSelect(repo)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {repo.private ? (
                      <Lock className="w-4 h-4 text-warning-500" />
                    ) : (
                      <Folder className="w-4 h-4 text-primary-500" />
                    )}
                  </div>
                  <h3 className="font-semibold text-secondary-900 truncate">
                    {repo.name || "Unknown"}
                  </h3>
                </div>
                {repo.html_url && (
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 text-secondary-400 hover:text-primary-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>

              {repo.description && (
                <p className="text-sm text-secondary-600 mb-3 line-clamp-2">
                  {repo.description}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-secondary-500">
                <div className="flex items-center space-x-3">
                  {repo.language && (
                    <div className="flex items-center space-x-1">
                      <span>
                        {getLanguageIcon(repo.language.toLowerCase())}
                      </span>
                      <span>{repo.language}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(repo.updated_at)}</span>
                  </div>
                </div>
                {repo.private && (
                  <span className="bg-warning-100 text-warning-800 px-2 py-1 rounded-full text-xs">
                    Private
                  </span>
                )}
              </div>

              {selectedRepo?.id === repo.id && (
                <div className="mt-3 pt-3 border-t border-primary-200">
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRepoSelect(repo);
                    }}
                  >
                    Continue with this repository
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="bg-secondary-50 rounded-lg p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-secondary-600">
            Showing {filteredRepos.length} of {safeRepositories.length}{" "}
            repositories
          </span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="text-primary-600 hover:text-primary-800 font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepoList;

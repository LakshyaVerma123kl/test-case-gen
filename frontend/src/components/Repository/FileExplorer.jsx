// components/Repository/FileExplorer.jsx
import React, { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  Code,
  CheckSquare,
  Square,
  Filter,
  Search,
  FolderOpen,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  File,
} from "lucide-react";
import { getRepositoryTree, getLanguageIcon } from "../../services/api";
import Button from "../UI/Button";
import LoadingSpinner from "../UI/LoadingSpinner";

const FileExplorer = ({
  repository,
  onFileSelect,
  selectedFiles = [],
  sessionId,
}) => {
  const [treeData, setTreeData] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set([""]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    if (repository && sessionId) {
      loadRepositoryTree();
    }
  }, [repository, sessionId]);

  const loadRepositoryTree = async () => {
    setLoading(true);
    setError(null);

    try {
      const tree = await getRepositoryTree(repository.full_name, sessionId);
      setTreeData(buildTreeStructure(tree));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load repository files");
    } finally {
      setLoading(false);
    }
  };

  const buildTreeStructure = (flatTree) => {
    const tree = [];
    const pathMap = new Map();

    // Sort by path to ensure proper order
    const sortedTree = flatTree.sort((a, b) => a.path.localeCompare(b.path));

    sortedTree.forEach((item) => {
      const parts = item.path.split("/");
      const fileName = parts[parts.length - 1];

      let currentLevel = tree;
      let currentPath = "";

      // Build nested structure
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let existingItem = currentLevel.find((node) => node.name === part);

        if (!existingItem) {
          const isLastPart = i === parts.length - 1;
          existingItem = {
            name: part,
            path: currentPath,
            type: isLastPart ? item.type : "tree",
            size: item.size,
            children: [],
            ...item,
          };
          currentLevel.push(existingItem);
        }

        currentLevel = existingItem.children;
      }
    });

    return tree;
  };

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileToggle = (file) => {
    const isSelected = selectedFiles.some((f) => f.path === file.path);
    const updatedFiles = isSelected
      ? selectedFiles.filter((f) => f.path !== file.path)
      : [...selectedFiles, file];

    onFileSelect(updatedFiles);
  };

  const selectAll = () => {
    const allFiles = getAllFiles(treeData);
    const filteredFiles = filterFiles(allFiles);
    onFileSelect(filteredFiles);
  };

  const deselectAll = () => {
    onFileSelect([]);
  };

  const getAllFiles = (nodes) => {
    let files = [];
    nodes.forEach((node) => {
      if (node.type === "blob") {
        files.push(node);
      } else if (node.children) {
        files = files.concat(getAllFiles(node.children));
      }
    });
    return files;
  };

  const filterFiles = (files) => {
    return files.filter((file) => {
      const matchesSearch =
        file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        file.path.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        filterType === "all" ||
        (filterType === "code" && isCodeFile(file.name)) ||
        (filterType === "test" && isTestFile(file.name)) ||
        (filterType === "config" && isConfigFile(file.name));

      return matchesSearch && matchesType;
    });
  };

  const isCodeFile = (filename) => {
    const codeExtensions = [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".cs",
      ".php",
      ".rb",
      ".go",
      ".rs",
    ];
    return codeExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
  };

  const isTestFile = (filename) => {
    const testPatterns = ["test", "spec", "__tests__"];
    return testPatterns.some((pattern) =>
      filename.toLowerCase().includes(pattern)
    );
  };

  const isConfigFile = (filename) => {
    const configFiles = [
      ".json",
      ".yml",
      ".yaml",
      ".xml",
      ".config.js",
      ".env",
      "dockerfile",
    ];
    return configFiles.some((ext) =>
      filename.toLowerCase().includes(ext.toLowerCase())
    );
  };

  const getFileIcon = (file) => {
    if (file.type === "tree") {
      return expandedFolders.has(file.path) ? (
        <FolderOpen className="h-4 w-4 text-blue-500" />
      ) : (
        <Folder className="h-4 w-4 text-blue-500" />
      );
    }

    if (isCodeFile(file.name)) {
      return <Code className="h-4 w-4 text-green-500" />;
    }

    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  const renderTreeNode = (node, depth = 0) => {
    const isFolder = node.type === "tree";
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFiles.some((f) => f.path === node.path);
    const paddingLeft = `${depth * 20 + 8}px`;

    // Filter logic for search and type
    const shouldShow = () => {
      if (isFolder) {
        // Show folder if it contains matching files or matches search itself
        const hasMatchingChildren = getAllFiles([node]).some((file) => {
          const matchesSearch =
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.path.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesType =
            filterType === "all" ||
            (filterType === "code" && isCodeFile(file.name)) ||
            (filterType === "test" && isTestFile(file.name)) ||
            (filterType === "config" && isConfigFile(file.name));
          return matchesSearch && matchesType;
        });

        return (
          hasMatchingChildren ||
          node.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      } else {
        const matchesSearch =
          node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.path.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType =
          filterType === "all" ||
          (filterType === "code" && isCodeFile(node.name)) ||
          (filterType === "test" && isTestFile(node.name)) ||
          (filterType === "config" && isConfigFile(node.name));
        return matchesSearch && matchesType;
      }
    };

    if (!shouldShow()) {
      return null;
    }

    return (
      <div key={node.path}>
        <div
          className={`flex items-center py-1 px-2 hover:bg-gray-50 cursor-pointer group ${
            isSelected ? "bg-primary-50 border-l-2 border-primary-500" : ""
          }`}
          style={{ paddingLeft }}
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.path);
            } else {
              handleFileToggle(node);
            }
          }}
        >
          {/* Expand/Collapse Icon for Folders */}
          {isFolder && (
            <div className="mr-1">
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-400" />
              )}
            </div>
          )}

          {/* Checkbox for Files */}
          {!isFolder && (
            <div className="mr-2">
              {isSelected ? (
                <CheckSquare className="h-4 w-4 text-primary-600" />
              ) : (
                <Square className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              )}
            </div>
          )}

          {/* File/Folder Icon */}
          <div className="mr-2">{getFileIcon(node)}</div>

          {/* Name and Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span
                className={`text-sm truncate ${
                  isFolder ? "font-medium text-gray-900" : "text-gray-700"
                }`}
              >
                {node.name}
              </span>
              {!isFolder && node.size && (
                <span className="text-xs text-gray-500 ml-2">
                  {formatFileSize(node.size)}
                </span>
              )}
            </div>
            {!isFolder && isCodeFile(node.name) && (
              <div className="text-xs text-gray-500 mt-0.5">
                {getLanguageIcon(node.name)} Code file
              </div>
            )}
          </div>
        </div>

        {/* Render Children */}
        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
        <div className="px-6 py-8 text-center">
          <LoadingSpinner size="large" />
          <div className="mt-4">
            <h3 className="text-lg font-medium text-secondary-900">
              Loading Repository Files
            </h3>
            <p className="text-sm text-secondary-600 mt-1">
              Fetching file structure from GitHub...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
        <div className="px-6 py-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-error-400" />
          <h3 className="mt-2 text-sm font-medium text-secondary-900">
            Failed to Load Files
          </h3>
          <p className="mt-1 text-sm text-secondary-500 mb-4">{error}</p>
          <Button onClick={loadRepositoryTree} variant="outline" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const allFiles = getAllFiles(treeData);
  const filteredFiles = filterFiles(allFiles);
  const selectedCount = selectedFiles.length;

  return (
    <div className="bg-white rounded-lg shadow-soft border border-secondary-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-secondary-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Folder className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900">
                File Explorer
              </h2>
              <p className="text-sm text-secondary-600">
                {repository.name} • {filteredFiles.length} files •{" "}
                {selectedCount} selected
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={filteredFiles.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAll}
              disabled={selectedCount === 0}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-6 py-4 bg-gray-50 border-b border-secondary-200">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            >
              <option value="all">All Files</option>
              <option value="code">Code Files</option>
              <option value="test">Test Files</option>
              <option value="config">Config Files</option>
            </select>
          </div>
        </div>
      </div>

      {/* File Tree */}
      <div className="max-h-96 overflow-y-auto">
        {treeData.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <File className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No files found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              This repository appears to be empty or the files couldn't be
              loaded.
            </p>
          </div>
        ) : (
          <div className="py-2">
            {treeData.map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {selectedCount > 0 && (
        <div className="px-6 py-3 bg-primary-50 border-t border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-medium text-primary-900">
                {selectedCount} file{selectedCount !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="text-xs text-primary-700">
              Ready for test case generation
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;

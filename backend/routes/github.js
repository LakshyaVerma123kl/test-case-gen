const express = require('express');
const { validateSession, githubClients } = require('./auth');
const GitHubService = require('../services/github');
const router = express.Router();

// Apply session validation to all routes
router.use(validateSession);

// Helper function to get GitHub client
const getGitHubClient = (sessionId) => {
  const client = githubClients.get(sessionId);
  if (!client) {
    throw new Error('GitHub client not found for session');
  }
  return client;
};

/**
 * Get user repositories
 */
router.get('/repos', async (req, res) => {
  try {
    const githubService = getGitHubClient(req.sessionId);
    const repositories = await githubService.getRepositories();

    res.json({
      success: true,
      repositories,
      count: repositories.length,
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({
      error: 'Failed to fetch repositories',
      message: error.message,
    });
  }
});

/**
 * Get repository details
 */
router.get('/repos/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const githubService = getGitHubClient(req.sessionId);

    const repository = await githubService.getRepository(owner, repo);
    const languages = await githubService.getRepositoryLanguages(owner, repo);

    res.json({
      success: true,
      repository: {
        ...repository,
        languages,
      },
    });
  } catch (error) {
    console.error('Error fetching repository:', error);
    res.status(500).json({
      error: 'Failed to fetch repository details',
      message: error.message,
    });
  }
});

/**
 * Get repository tree structure
 */
router.get('/repos/:owner/:repo/tree', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { path = '', recursive = 'false' } = req.query;
    const githubService = getGitHubClient(req.sessionId);

    const tree = await githubService.getRepositoryTree(owner, repo, 'HEAD', recursive === 'true');

    res.json(tree.tree || []);
  } catch (error) {
    console.error('Error fetching repository tree:', error);
    res.status(500).json({
      error: 'Failed to fetch repository tree',
      message: error.message,
    });
  }
});

/**
 * Get file contents
 */
router.get('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const filePath = req.params[0]; // Get the wildcard path
    const githubService = getGitHubClient(req.sessionId);

    const fileData = await githubService.getFileContent(owner, repo, filePath);

    res.json({
      success: true,
      file: fileData,
    });
  } catch (error) {
    console.error('Error fetching file content:', error);
    res.status(500).json({
      error: 'Failed to fetch file content',
      message: error.message,
    });
  }
});

/**
 * Get repository branches
 */
router.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const githubService = getGitHubClient(req.sessionId);

    const branches = await githubService.getBranches(owner, repo);

    res.json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({
      error: 'Failed to fetch branches',
      message: error.message,
    });
  }
});

/**
 * Create a new file
 */
router.post('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const filePath = req.params[0];
    const { content, message, branch = 'main' } = req.body;

    if (!content || !message) {
      return res.status(400).json({
        error: 'Content and commit message are required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);
    const result = await githubService.createFile(owner, repo, filePath, content, message, branch);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error creating file:', error);
    res.status(500).json({
      error: 'Failed to create file',
      message: error.message,
    });
  }
});

/**
 * Update an existing file
 */
router.put('/repos/:owner/:repo/contents/*', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const filePath = req.params[0];
    const { content, message, sha, branch = 'main' } = req.body;

    if (!content || !message || !sha) {
      return res.status(400).json({
        error: 'Content, commit message, and file SHA are required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);
    const result = await githubService.updateFile(
      owner,
      repo,
      filePath,
      content,
      message,
      sha,
      branch
    );

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Error updating file:', error);
    res.status(500).json({
      error: 'Failed to update file',
      message: error.message,
    });
  }
});

/**
 * Create a pull request
 */
router.post('/repos/:owner/:repo/pulls', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { title, head, base, body = '' } = req.body;

    if (!title || !head || !base) {
      return res.status(400).json({
        error: 'Title, head branch, and base branch are required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);
    const pullRequest = await githubService.createPullRequest(owner, repo, title, head, base, body);

    res.json({
      success: true,
      pullRequest,
    });
  } catch (error) {
    console.error('Error creating pull request:', error);
    res.status(500).json({
      error: 'Failed to create pull request',
      message: error.message,
    });
  }
});

/**
 * Search repositories (for the authenticated user)
 */
router.get('/search/repositories', async (req, res) => {
  try {
    const { q, sort = 'updated', order = 'desc', per_page = 30, page = 1 } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Search query (q) is required',
      });
    }

    const githubService = getGitHubClient(req.sessionId);
    const searchResults = await githubService.searchRepositories(q, {
      sort,
      order,
      per_page: parseInt(per_page),
      page: parseInt(page),
    });

    res.json({
      success: true,
      ...searchResults,
    });
  } catch (error) {
    console.error('Error searching repositories:', error);
    res.status(500).json({
      error: 'Failed to search repositories',
      message: error.message,
    });
  }
});

module.exports = router;

const { Octokit } = require('@octokit/rest');

class GitHubService {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error('GitHub access token is required');
    }

    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: 'AI-Test-Case-Generator/1.0.0',
      baseUrl: 'https://api.github.com',
      request: {
        timeout: 30000, // 30 seconds timeout
      },
    });

    this.accessToken = accessToken;
  }

  // Get user information with enhanced error handling
  async getUser() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();

      if (!data || !data.login) {
        throw new Error('Invalid user data received from GitHub');
      }

      return data;
    } catch (error) {
      if (error.status === 401) {
        throw new Error('Invalid or expired GitHub token');
      } else if (error.status === 403) {
        throw new Error('GitHub token does not have required permissions');
      }
      throw new Error(`Failed to get user information: ${error.message}`);
    }
  }

  // FIXED: Get user repositories with improved error handling and fallback
  async getRepositories(options = {}) {
    try {
      const {
        sort = 'updated',
        direction = 'desc',
        per_page = 50,
        page = 1,
        type = 'all',
      } = options;

      // Primary attempt - simplified parameters to avoid compatibility issues
      const requestParams = {
        sort,
        direction,
        per_page: Math.min(per_page, 100), // GitHub API limit
        page,
        type, // 'all', 'owner', 'public', 'private', 'member'
        // Removed problematic 'visibility' parameter
      };

      console.log('🔍 Fetching repositories with params:', requestParams);

      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser(requestParams);

      console.log(`✅ Successfully fetched ${data.length} repositories`);

      return data;
    } catch (error) {
      console.error('❌ Primary repository fetch failed:', error.message);

      // Handle specific errors and provide fallbacks
      if (error.status === 401) {
        throw new Error('Authentication failed - please check your GitHub token');
      } else if (error.status === 403) {
        throw new Error('Insufficient permissions - ensure your token has repo scope');
      }

      // Try fallback method for compatibility issues
      console.log('🔄 Attempting fallback repository fetch...');
      return await this.getRepositoriesFallback(options);
    }
  }

  // Fallback method for repository fetching
  async getRepositoriesFallback(options = {}) {
    try {
      const { sort = 'updated', direction = 'desc', per_page = 50, page = 1 } = options;

      // Try with minimal parameters first
      try {
        const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
          sort,
          direction,
          per_page: Math.min(per_page, 100),
          page,
        });
        console.log('✅ Fallback method 1 successful');
        return data;
      } catch (minimalError) {
        console.log('⚠️ Minimal params failed, trying basic request...');
      }

      // Try with absolutely basic parameters
      try {
        const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
          per_page: 50,
        });
        console.log('✅ Fallback method 2 successful');
        return data;
      } catch (basicError) {
        console.log('⚠️ Basic request failed, trying user repos endpoint...');
      }

      // Last resort: try user repos endpoint (may not include all private repos)
      const user = await this.getUser();
      const { data } = await this.octokit.rest.repos.listForUser({
        username: user.login,
        per_page: 50,
      });

      console.log('✅ Fallback method 3 successful (public repos only)');
      console.log('ℹ️ Note: This method may not include all private repositories');

      return data;
    } catch (error) {
      console.error('❌ All repository fetch methods failed:', error.message);
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  // Get repository details with language information
  async getRepository(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      // Get additional repository information
      const [languages, topics] = await Promise.all([
        this.getRepositoryLanguages(owner, repo).catch(() => ({})),
        this.getRepositoryTopics(owner, repo).catch(() => []),
      ]);

      return {
        ...data,
        languages,
        topics,
      };
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
      } else if (error.status === 403) {
        throw new Error(`Access denied to repository ${owner}/${repo}`);
      }
      throw new Error(`Failed to get repository: ${error.message}`);
    }
  }

  // Get repository contents with better error handling
  async getRepositoryContents(owner, repo, path = '') {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });
      return data;
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Path ${path} not found in repository ${owner}/${repo}`);
      }
      throw new Error(`Failed to get repository contents: ${error.message}`);
    }
  }

  // Get file content with size validation
  async getFileContent(owner, repo, path) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      // Check file size (GitHub API has 1MB limit for content)
      if (data.size > 1000000) {
        throw new Error(
          "File too large (>1MB). Please use GitHub's raw content API for large files."
        );
      }

      // Decode base64 content
      let decodedContent;
      try {
        decodedContent = Buffer.from(data.content, 'base64').toString('utf-8');
      } catch (decodeError) {
        // Handle binary files
        decodedContent = data.content;
      }

      return {
        ...data,
        decodedContent,
      };
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`File ${path} not found in repository ${owner}/${repo}`);
      } else if (error.status === 403) {
        throw new Error(`Access denied to file ${path} in repository ${owner}/${repo}`);
      }
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // Get repository languages
  async getRepositoryLanguages(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo,
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository languages: ${error.message}`);
    }
  }

  // Get repository topics
  async getRepositoryTopics(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.getAllTopics({
        owner,
        repo,
      });
      return data.names || [];
    } catch (error) {
      // Topics might not be accessible, return empty array
      return [];
    }
  }

  // Search repositories with enhanced filtering
  async searchRepositories(query, options = {}) {
    try {
      const { sort = 'updated', order = 'desc', per_page = 30, page = 1 } = options;

      const { data } = await this.octokit.rest.search.repos({
        q: query,
        sort,
        order,
        per_page: Math.min(per_page, 100),
        page,
      });

      return data;
    } catch (error) {
      if (error.status === 422) {
        throw new Error('Invalid search query');
      }
      throw new Error(`Failed to search repositories: ${error.message}`);
    }
  }

  // Get repository tree with size limits
  async getRepositoryTree(owner, repo, treeSha = 'HEAD', recursive = false) {
    try {
      const { data } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive,
      });

      // Filter out large files and directories we don't need
      if (data.tree) {
        data.tree = data.tree.filter((item) => {
          // Skip files larger than 100KB for analysis
          if (item.type === 'blob' && item.size > 100000) {
            return false;
          }

          // Skip common directories that don't need testing
          const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__'];
          if (item.type === 'tree' && skipDirs.some((dir) => item.path.includes(dir))) {
            return false;
          }

          return true;
        });
      }

      return data;
    } catch (error) {
      if (error.status === 404) {
        throw new Error(`Repository tree not found for ${owner}/${repo}`);
      }
      throw new Error(`Failed to get repository tree: ${error.message}`);
    }
  }

  // Get commits with pagination
  async getCommits(owner, repo, options = {}) {
    try {
      const { sha, path, author, since, until, per_page = 30, page = 1 } = options;

      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha,
        path,
        author,
        since,
        until,
        per_page: Math.min(per_page, 100),
        page,
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to get commits: ${error.message}`);
    }
  }

  // Get branches
  async getBranches(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get branches: ${error.message}`);
    }
  }

  // Get pull requests
  async getPullRequests(owner, repo, state = 'open') {
    try {
      const { data } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state,
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get pull requests: ${error.message}`);
    }
  }

  // Get issues
  async getIssues(owner, repo, state = 'open') {
    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state,
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get issues: ${error.message}`);
    }
  }

  // Create a new file
  async createFile(owner, repo, path, content, message, branch = 'main') {
    try {
      // Check if file already exists
      try {
        await this.getFileContent(owner, repo, path);
        throw new Error(`File ${path} already exists`);
      } catch (error) {
        if (!error.message.includes('not found')) {
          throw error;
        }
        // File doesn't exist, continue with creation
      }

      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
      });
      return data;
    } catch (error) {
      if (error.status === 409) {
        throw new Error(`File ${path} already exists`);
      }
      throw new Error(`Failed to create file: ${error.message}`);
    }
  }

  // Update an existing file
  async updateFile(owner, repo, path, content, message, sha, branch = 'main') {
    try {
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        sha,
        branch,
      });
      return data;
    } catch (error) {
      if (error.status === 409) {
        throw new Error(`Conflict updating file ${path}. File may have been modified.`);
      }
      throw new Error(`Failed to update file: ${error.message}`);
    }
  }

  // Create a new branch
  async createBranch(owner, repo, branchName, fromBranch = 'main') {
    try {
      // Get the SHA of the source branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${fromBranch}`,
      });

      // Create new branch
      const { data } = await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      });

      return data;
    } catch (error) {
      if (error.status === 422) {
        throw new Error(`Branch ${branchName} already exists`);
      }
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }

  // Create a pull request
  async createPullRequest(owner, repo, title, head, base, body = '') {
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
      });
      return data;
    } catch (error) {
      if (error.status === 422) {
        throw new Error('Invalid pull request parameters or pull request already exists');
      }
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }

  // Rate limit checking
  async getRateLimit() {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      return data;
    } catch (error) {
      throw new Error(`Failed to get rate limit: ${error.message}`);
    }
  }

  // Check token permissions
  async checkTokenPermissions() {
    try {
      const { headers } = await this.octokit.rest.users.getAuthenticated();
      const scopes = headers['x-oauth-scopes'] || '';

      return {
        scopes: scopes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        hasRepoAccess: scopes.includes('repo') || scopes.includes('public_repo'),
        hasUserAccess: scopes.includes('user') || scopes.includes('user:email'),
      };
    } catch (error) {
      throw new Error(`Failed to check token permissions: ${error.message}`);
    }
  }

  // Validate repository access
  async validateRepositoryAccess(owner, repo) {
    try {
      await this.getRepository(owner, repo);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get repository statistics
  async getRepositoryStats(owner, repo) {
    try {
      const [repoData, languages, commits] = await Promise.all([
        this.getRepository(owner, repo),
        this.getRepositoryLanguages(owner, repo).catch(() => ({})),
        this.getCommits(owner, repo, { per_page: 1 }).catch(() => []),
      ]);

      return {
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        language: repoData.language,
        languages,
        size: repoData.size,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        openIssues: repoData.open_issues_count,
        defaultBranch: repoData.default_branch,
        createdAt: repoData.created_at,
        updatedAt: repoData.updated_at,
        pushedAt: repoData.pushed_at,
        private: repoData.private,
        hasCommits: commits.length > 0,
      };
    } catch (error) {
      throw new Error(`Failed to get repository statistics: ${error.message}`);
    }
  }
}

module.exports = GitHubService;

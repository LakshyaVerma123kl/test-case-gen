const { Octokit } = require('@octokit/rest');

class GitHubService {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error('GitHub access token is required');
    }
    this.octokit = new Octokit({
      auth: accessToken,
    });
  }

  // Get user information
  async getUser() {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return data;
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  // Get user repositories
  async getRepositories(options = {}) {
    try {
      const {
        visibility = 'all',
        sort = 'updated',
        direction = 'desc',
        per_page = 30,
        page = 1
      } = options;

      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility,
        sort,
        direction,
        per_page,
        page
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to get repositories: ${error.message}`);
    }
  }

  // Get repository details
  async getRepository(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository: ${error.message}`);
    }
  }

  // Get repository contents
  async getRepositoryContents(owner, repo, path = '') {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository contents: ${error.message}`);
    }
  }

  // Get file content
  async getFileContent(owner, repo, path) {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path
      });

      if (data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      // Decode base64 content
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        ...data,
        decodedContent: content
      };
    } catch (error) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  // Get repository languages
  async getRepositoryLanguages(owner, repo) {
    try {
      const { data } = await this.octokit.rest.repos.listLanguages({
        owner,
        repo
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository languages: ${error.message}`);
    }
  }

  // Search repositories
  async searchRepositories(query, options = {}) {
    try {
      const {
        sort = 'updated',
        order = 'desc',
        per_page = 30,
        page = 1
      } = options;

      const { data } = await this.octokit.rest.search.repos({
        q: query,
        sort,
        order,
        per_page,
        page
      });

      return data;
    } catch (error) {
      throw new Error(`Failed to search repositories: ${error.message}`);
    }
  }

  // Get repository tree (for exploring file structure)
  async getRepositoryTree(owner, repo, treeSha = 'HEAD', recursive = false) {
    try {
      const { data } = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository tree: ${error.message}`);
    }
  }

  // Get commits for a repository
  async getCommits(owner, repo, options = {}) {
    try {
      const {
        sha,
        path,
        author,
        since,
        until,
        per_page = 30,
        page = 1
      } = options;

      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha,
        path,
        author,
        since,
        until,
        per_page,
        page
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
        repo
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
        state
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
        state
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get issues: ${error.message}`);
    }
  }

  // Create a new file
  async createFile(owner, repo, path, content, message, branch = 'main') {
    try {
      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch
      });
      return data;
    } catch (error) {
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
        branch
      });
      return data;
    } catch (error) {
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
        ref: `heads/${fromBranch}`
      });

      // Create new branch
      const { data } = await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha
      });

      return data;
    } catch (error) {
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
        body
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to create pull request: ${error.message}`);
    }
  }
}

module.exports = GitHubService;
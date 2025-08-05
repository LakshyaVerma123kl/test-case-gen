const express = require('express');
const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const GitHubService = require('../services/github');
const router = express.Router();

// Store GitHub clients and sessions in memory (in production, use Redis or proper session store)
const githubClients = new Map();
const activeSessions = new Map();

// Session timeout (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

// Middleware to validate session
const validateSession = (req, res, next) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Check if session has expired
  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    activeSessions.delete(sessionId);
    githubClients.delete(sessionId);
    return res.status(401).json({ error: 'Session expired' });
  }

  // Update last accessed time
  session.lastAccessed = Date.now();
  req.sessionId = sessionId;
  req.githubToken = session.accessToken;

  next();
};

/**
 * Main GitHub authentication endpoint
 * Handles both OAuth code exchange and direct token authentication
 */
router.post('/github', async (req, res) => {
  try {
    console.log('🔄 GitHub authentication request received');
    console.log('Request body keys:', Object.keys(req.body));

    const { code, state, token } = req.body;

    // Handle direct token authentication (most common case)
    if (token) {
      console.log('🔑 Using direct token authentication');
      return await handleTokenAuth(req, res, token);
    }

    // Handle OAuth flow
    if (code) {
      console.log('🔄 Using OAuth code exchange');
      return await handleOAuthFlow(req, res, code, state);
    }

    // Neither token nor code provided
    return res.status(400).json({
      error: 'Either token or authorization code is required',
      received: { hasCode: !!code, hasToken: !!token },
    });
  } catch (error) {
    console.error('❌ GitHub authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Handle direct token authentication
 */
async function handleTokenAuth(req, res, accessToken) {
  try {
    // Validate token format
    if (!accessToken.startsWith('ghp_') && !accessToken.startsWith('github_pat_')) {
      return res.status(400).json({
        error: 'Invalid GitHub token format',
        hint: 'Token should start with "ghp_" or "github_pat_"',
      });
    }

    console.log('🔄 Creating GitHub service with token...');

    // Test the token by creating GitHub service and fetching user info
    const githubService = new GitHubService(accessToken);

    console.log('🔄 Fetching user information from GitHub...');
    const user = await githubService.getUser();

    if (!user || !user.login) {
      throw new Error('Invalid token: Unable to fetch user information');
    }

    console.log('✅ User information received:', user.login);

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store session
    const session = {
      sessionId,
      accessToken,
      user: {
        id: user.id,
        login: user.login,
        name: user.name || user.login,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    activeSessions.set(sessionId, session);
    githubClients.set(sessionId, githubService);

    console.log('✅ Session created successfully for user:', user.login);

    res.json({
      success: true,
      sessionId,
      user: session.user,
      expiresIn: SESSION_TIMEOUT,
      expiresAt: session.createdAt + SESSION_TIMEOUT,
    });
  } catch (error) {
    console.error('❌ Token authentication error:', error);

    // Provide more specific error messages
    if (error.status === 401) {
      return res.status(401).json({
        error: 'Invalid GitHub token',
        message: 'The provided token is invalid or has expired',
        hint: 'Please generate a new token with the required permissions',
      });
    }

    if (error.status === 403) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'The token does not have the required permissions',
        hint: 'Ensure your token has "repo" and "user:email" scopes',
      });
    }

    throw error;
  }
}

/**
 * Handle OAuth code exchange
 */
async function handleOAuthFlow(req, res, code, state) {
  console.log('🔄 Starting OAuth code exchange...');

  // Check if GitHub OAuth is configured
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.log('❌ GitHub OAuth not configured');
    return res.status(500).json({
      error: 'GitHub OAuth not configured on server',
      details: 'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET missing',
    });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Test-Case-Generator/1.0.0',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        state: state,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`GitHub API responded with status: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('GitHub token response received:', {
      success: !!tokenData.access_token,
      error: tokenData.error,
    });

    if (tokenData.error) {
      console.log('❌ GitHub OAuth error:', tokenData.error_description);
      return res.status(400).json({
        error: 'GitHub OAuth error',
        details: tokenData.error_description || tokenData.error,
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.log('❌ No access token received from GitHub');
      return res.status(400).json({
        error: 'Failed to obtain access token',
        details: 'GitHub did not return an access token',
      });
    }

    console.log('✅ Access token obtained, proceeding with authentication...');
    return await handleTokenAuth(req, res, accessToken);
  } catch (error) {
    console.error('❌ OAuth flow error:', error);
    throw error;
  }
}

// Get current user info
router.get('/me', validateSession, (req, res) => {
  const session = activeSessions.get(req.sessionId);
  res.json({
    user: session.user,
    sessionId: req.sessionId,
    expiresAt: session.createdAt + SESSION_TIMEOUT,
    authenticated: true,
  });
});

// Logout endpoint
router.post('/logout', validateSession, (req, res) => {
  const sessionId = req.sessionId;
  activeSessions.delete(sessionId);
  githubClients.delete(sessionId);
  console.log('✅ User logged out successfully');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Get OAuth URL for GitHub (for OAuth flow)
router.get('/github/oauth-url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }

  const state = crypto.randomBytes(16).toString('hex');
  const scope = 'repo user:email';
  const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/callback';

  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.json({
    oauthUrl,
    state,
    clientId,
    scope: scope.split(' '),
    redirectUri,
  });
});

// Session status check
router.get('/status', (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');

  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.json({
      authenticated: false,
      reason: 'No valid session found',
    });
  }

  const session = activeSessions.get(sessionId);
  const isExpired = Date.now() - session.createdAt > SESSION_TIMEOUT;

  if (isExpired) {
    activeSessions.delete(sessionId);
    githubClients.delete(sessionId);
    return res.json({
      authenticated: false,
      reason: 'Session expired',
    });
  }

  // Update last accessed time
  session.lastAccessed = Date.now();

  res.json({
    authenticated: true,
    user: session.user,
    sessionId,
    expiresAt: session.createdAt + SESSION_TIMEOUT,
    timeRemaining: session.createdAt + SESSION_TIMEOUT - Date.now(),
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'Auth route is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    githubConfigured: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    endpoints: {
      main: 'POST /api/auth/github',
      status: 'GET /api/auth/status',
      me: 'GET /api/auth/me',
      logout: 'POST /api/auth/logout',
      oauthUrl: 'GET /api/auth/github/oauth-url',
    },
  });
});

// Health check for active sessions
router.get('/health', (req, res) => {
  const now = Date.now();
  const sessionCount = activeSessions.size;
  const expiredSessions = Array.from(activeSessions.values()).filter(
    (session) => now - session.createdAt > SESSION_TIMEOUT
  ).length;

  res.json({
    status: 'healthy',
    activeSessions: sessionCount,
    expiredSessions,
    timestamp: now,
  });
});

// Clean up expired sessions (run every hour)
const cleanupExpiredSessions = () => {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
      githubClients.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired sessions`);
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Run initial cleanup
cleanupExpiredSessions();

module.exports = router;
module.exports.validateSession = validateSession;
module.exports.githubClients = githubClients;
module.exports.activeSessions = activeSessions;

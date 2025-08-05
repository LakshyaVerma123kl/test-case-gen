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
 * NEW: Direct endpoint for /auth/github
 * This lets your frontend post directly to /api/auth/github without hitting 404
 * Internally it just calls the same logic as /github/callback
 */
router.post('/github', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        state: state,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        error: 'GitHub OAuth error',
        details: tokenData.error_description,
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    // Create GitHub service instance
    const githubService = new GitHubService(accessToken);

    // Get user information
    const user = await githubService.getUser();

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store session
    const session = {
      sessionId,
      accessToken,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    activeSessions.set(sessionId, session);
    githubClients.set(sessionId, githubService);

    res.json({
      sessionId,
      user: session.user,
      expiresIn: SESSION_TIMEOUT,
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
});

// Existing callback route (kept for compatibility if needed)
router.post('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        state: state,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return res.status(400).json({
        error: 'GitHub OAuth error',
        details: tokenData.error_description,
      });
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.status(400).json({ error: 'Failed to obtain access token' });
    }

    const githubService = new GitHubService(accessToken);
    const user = await githubService.getUser();
    const sessionId = crypto.randomBytes(32).toString('hex');

    const session = {
      sessionId,
      accessToken,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    activeSessions.set(sessionId, session);
    githubClients.set(sessionId, githubService);

    res.json({
      sessionId,
      user: session.user,
      expiresIn: SESSION_TIMEOUT,
    });
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
});

// Get current user info
router.get('/me', validateSession, (req, res) => {
  const session = activeSessions.get(req.sessionId);
  res.json({
    user: session.user,
    sessionId: req.sessionId,
    expiresAt: session.createdAt + SESSION_TIMEOUT,
  });
});

// Logout endpoint
router.post('/logout', validateSession, (req, res) => {
  const sessionId = req.sessionId;
  activeSessions.delete(sessionId);
  githubClients.delete(sessionId);
  res.json({ message: 'Logged out successfully' });
});

// Get OAuth URL for GitHub
router.get('/github/oauth-url', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GitHub OAuth not configured' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  const scope = 'repo user:email';
  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&state=${state}`;
  res.json({ oauthUrl, state });
});

// Session status check
router.get('/status', (req, res) => {
  const sessionId = req.headers.authorization?.replace('Bearer ', '');
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.json({ authenticated: false });
  }
  const session = activeSessions.get(sessionId);
  const isExpired = Date.now() - session.createdAt > SESSION_TIMEOUT;
  if (isExpired) {
    activeSessions.delete(sessionId);
    githubClients.delete(sessionId);
    return res.json({ authenticated: false, reason: 'expired' });
  }
  res.json({
    authenticated: true,
    user: session.user,
    expiresAt: session.createdAt + SESSION_TIMEOUT,
  });
});

// Clean up expired sessions
const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      activeSessions.delete(sessionId);
      githubClients.delete(sessionId);
    }
  }
};
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = router;
module.exports.validateSession = validateSession;
module.exports.githubClients = githubClients;
module.exports.activeSessions = activeSessions;

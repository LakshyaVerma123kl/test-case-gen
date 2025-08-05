const express = require('express');
const crypto = require('crypto');
const GitHubService = require('../services/github');

const router = express.Router();

// In-memory session store (replace with Redis/DB in production)
const githubClients = new Map();
const activeSessions = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

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

  // Expiration check
  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    activeSessions.delete(sessionId);
    githubClients.delete(sessionId);
    return res.status(401).json({ error: 'Session expired' });
  }

  req.sessionId = sessionId;
  req.githubToken = session.accessToken;
  next();
};

/**
 * Authenticate with GitHub using a Personal Access Token
 */
router.post('/github', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }

    const githubService = new GitHubService(token);

    // Get authenticated user from GitHub API
    const user = await githubService.getUser();

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Store session in memory
    const session = {
      sessionId,
      accessToken: token,
      user: {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      createdAt: Date.now(),
    };

    activeSessions.set(sessionId, session);
    githubClients.set(sessionId, githubService);

    res.json({
      success: true,
      user: session.user,
      sessionId,
      expiresIn: SESSION_TIMEOUT,
    });
  } catch (error) {
    console.error('GitHub token authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
});

/**
 * Get current authenticated user
 */
router.get('/me', validateSession, (req, res) => {
  const session = activeSessions.get(req.sessionId);
  res.json({
    user: session.user,
    sessionId: req.sessionId,
    expiresAt: session.createdAt + SESSION_TIMEOUT,
  });
});

/**
 * Logout
 */
router.post('/logout', validateSession, (req, res) => {
  activeSessions.delete(req.sessionId);
  githubClients.delete(req.sessionId);
  res.json({ message: 'Logged out successfully' });
});

/**
 * Check session status
 */
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

/**
 * Cleanup expired sessions every hour
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [sessionId, session] of activeSessions.entries()) {
      if (now - session.createdAt > SESSION_TIMEOUT) {
        activeSessions.delete(sessionId);
        githubClients.delete(sessionId);
      }
    }
  },
  60 * 60 * 1000
);

module.exports = router;
module.exports.validateSession = validateSession;
module.exports.githubClients = githubClients;
module.exports.activeSessions = activeSessions;

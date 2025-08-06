// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const githubRoutes = require('./routes/github');
const testcaseRoutes = require('./routes/testcases');

const app = express();

// ✅ CRITICAL FIX: Use Render's dynamic PORT (don't hardcode)
const PORT = process.env.PORT || 5000;

// -------------------- Trust Proxy (CRITICAL FIX) --------------------
// ✅ FIXED: Properly configure trust proxy for production
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1); // Trust first proxy (Render, Heroku, etc.)
  console.log('✅ Trust proxy enabled for production environment');
} else {
  app.set('trust proxy', false);
  console.log('🔧 Trust proxy disabled for development environment');
}

// -------------------- Security Middleware --------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  })
);

// -------------------- CORS Configuration (CRITICAL FIX) --------------------
// ✅ FIXED: Simplified and more robust CORS configuration
const allowedOrigins = [
  'https://test-case-gen-self.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
]
  .filter(Boolean)
  .filter((origin, index, arr) => arr.indexOf(origin) === index); // Remove duplicates

console.log('🌐 Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    console.log(`🔍 CORS check for origin: ${origin || 'no-origin'}`);

    // Allow requests with no origin (mobile apps, Postman, curl, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }

    // Check if origin is exactly in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Origin ${origin} is explicitly allowed`);
      return callback(null, true);
    }

    // Log and reject
    console.warn(`🚫 CORS: Origin ${origin} not in allowed list:`, allowedOrigins);
    return callback(
      new Error(
        `CORS policy: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`
      ),
      false
    );
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// -------------------- Rate Limiting (FIXED) --------------------
// ✅ FIXED: Improved rate limiting configuration with better error handling
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks and OPTIONS requests
    return req.path === '/api/health' || req.path === '/api' || req.method === 'OPTIONS';
  },
  // ✅ FIXED: Better key generation with error handling
  keyGenerator: (req) => {
    // In production with trust proxy, use the real IP
    if (process.env.NODE_ENV === 'production') {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
    // In development, use connection remote address
    return req.connection.remoteAddress || req.ip || 'unknown';
  },
  // ✅ FIXED: Add error handler for rate limiter
  onLimitReached: (req, res, options) => {
    console.warn(`⚠️  Rate limit exceeded for ${req.ip} on ${req.path}`);
  },
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Special rate limiting for AI endpoints with more lenient settings for debugging
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW) || 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.AI_RATE_LIMIT_REQUESTS) || 50,
  message: {
    error: 'Too many AI requests from this IP, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (process.env.NODE_ENV === 'production') {
      return req.ip || req.connection.remoteAddress || 'unknown';
    }
    return req.connection.remoteAddress || req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip AI rate limiting in development for easier debugging
    return process.env.NODE_ENV === 'development';
  },
});

app.use('/api/testcases/generate', aiLimiter);

// -------------------- Body Parsing --------------------
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON in request body' });
        throw new Error('Invalid JSON');
      }
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// -------------------- Request Logging (Enhanced) --------------------
app.use((req, res, next) => {
  const start = Date.now();

  // Log incoming request
  console.log(`📥 ${req.method} ${req.path} - ${req.ip} - Origin: ${req.get('origin') || 'none'}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusIcon = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';

    console.log(`📤 ${statusIcon} ${req.method} ${req.path} - ${status} (${duration}ms)`);
  });

  next();
});

// -------------------- Health Check (before other routes) --------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    port: PORT,
    corsOrigins: allowedOrigins,
    trustProxy: app.get('trust proxy'),
  });
});

// -------------------- Root API Endpoint --------------------
app.get('/api', (req, res) => {
  res.json({
    name: 'AI Test Case Generator API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        github: 'POST /api/auth/github',
        status: 'GET /api/auth/status',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout',
        test: 'GET /api/auth/test',
      },
      github: {
        repos: 'GET /api/github/repos',
        repoDetails: 'GET /api/github/repos/:owner/:repo',
        tree: 'GET /api/github/repos/:owner/:repo/tree',
        fileContent: 'GET /api/github/repos/:owner/:repo/contents/*',
      },
      testcases: {
        generate: 'POST /api/testcases/generate',
        generateRepo: 'POST /api/testcases/generate/repository',
        generateFile: 'POST /api/testcases/generate/file',
        suggestions: 'POST /api/testcases/suggestions',
        frameworks: 'GET /api/testcases/frameworks',
        types: 'GET /api/testcases/types',
      },
    },
    corsOrigins: allowedOrigins,
    documentation: 'https://github.com/yourusername/ai-test-case-generator#api-documentation',
  });
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/api');
});

// -------------------- API Routes --------------------
app.use('/api/auth', authRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/testcases', testcaseRoutes);

// -------------------- 404 Handler --------------------
app.use('*', (req, res) => {
  console.warn(`🚫 404 - Route not found: ${req.method} ${req.originalUrl}`);

  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    suggestion: 'Check the API documentation at /api for available endpoints',
    availableEndpoints: [
      'GET /api - API information',
      'GET /api/health - Health check',
      'POST /api/auth/github - GitHub authentication',
      'GET /api/auth/status - Session status',
      'GET /api/github/repos - List repositories',
      'POST /api/testcases/generate - Generate test cases',
    ],
  });
});

// -------------------- Global Error Handler (Enhanced) --------------------
app.use((err, req, res, next) => {
  console.error(`❌ Error on ${req.method} ${req.path}:`, err);

  const isDevelopment = process.env.NODE_ENV === 'development';
  const status = err.status || err.statusCode || 500;

  // Log error details in development
  if (isDevelopment) {
    console.error('Error stack:', err.stack);
  }

  // Handle specific error types
  let message = 'Internal Server Error';

  if (err.type === 'entity.parse.failed') {
    message = 'Invalid JSON in request body';
    return res.status(400).json({ error: message });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    message = 'Request body too large';
    return res.status(413).json({ error: message });
  }

  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS policy')) {
    message = err.message;
    return res.status(403).json({
      error: message,
      allowedOrigins: allowedOrigins,
      requestOrigin: req.get('origin'),
    });
  }

  if (err.message && status < 500) {
    message = err.message;
  }

  res.status(status).json({
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
    ...(isDevelopment && {
      stack: err.stack,
      details: err.toString(),
    }),
  });
});

// -------------------- Process Error Handlers --------------------
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the process in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Continuing process despite unhandled rejection...');
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Process will exit...');
  process.exit(1);
});

// -------------------- Graceful Shutdown --------------------
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }

    console.log('✅ Server closed gracefully');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ✅ CRITICAL FIX: Listen on 0.0.0.0 and use dynamic PORT
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);

  // ✅ FIX: Use correct base URL for production
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? `https://test-case-gen-e98c.onrender.com`
      : `http://localhost:${PORT}`;

  console.log(`🚀 API Base URL: ${baseUrl}/api`);
  console.log(`🩺 Health check: ${baseUrl}/api/health`);
  console.log(`📚 Documentation: ${baseUrl}/api`);
  console.log('🚀 ================================');

  // Log configuration
  console.log('🔧 Configuration:');
  console.log(`   - CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`   - Trust Proxy: ${app.get('trust proxy')}`);
  console.log(`   - Rate Limit: ${process.env.RATE_LIMIT_REQUESTS || 100}/15min`);
  console.log(`   - AI Rate Limit: ${process.env.AI_RATE_LIMIT_REQUESTS || 50}/hour`);
  console.log(
    `   - GitHub OAuth: ${!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}`
  );
  console.log(`   - Gemini API: ${!!process.env.GEMINI_API_KEY}`);

  // ✅ Log successful port binding (critical for Render)
  console.log(`✅ Server successfully bound to port ${PORT} on all interfaces (0.0.0.0)`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);

  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${PORT}`);
    process.exit(1);
  }
});

module.exports = app;

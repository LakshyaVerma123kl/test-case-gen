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

// ✅ CRITICAL FIX: Use Render's PORT environment variable
const PORT = process.env.PORT || 5000;

// -------------------- Trust Proxy (important for deployed apps) --------------------
app.set('trust proxy', 1);

// -------------------- Security Middleware --------------------
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false,
  })
);

// -------------------- Rate Limiting --------------------
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
    // Skip rate limiting for health checks
    return req.path === '/api/health' || req.path === '/api';
  },
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// Special rate limiting for AI endpoints
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW) || 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.AI_RATE_LIMIT_REQUESTS) || 50,
  message: {
    error: 'Too many AI requests from this IP, please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/testcases/generate', aiLimiter);

// -------------------- CORS Configuration --------------------
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ALLOWED_ORIGINS?.split(',') || [],
  'http://localhost:3000',
  'http://localhost:5173', // Vite default
  'https://test-case-gen-self.vercel.app',
]
  .flat()
  .filter(Boolean);

console.log('🌐 Allowed CORS origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (
      allowedOrigins.some((allowedOrigin) => {
        if (allowedOrigin === origin) return true;
        // Allow wildcards for development
        if (allowedOrigin.includes('*')) {
          const pattern = new RegExp(allowedOrigin.replace(/\*/g, '.*'));
          return pattern.test(origin);
        }
        return false;
      })
    ) {
      return callback(null, true);
    }

    console.warn(`🚫 CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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

// -------------------- Request Logging --------------------
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use((req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });

    next();
  });
}

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
    port: PORT, // ✅ Show the actual port being used
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
    port: PORT, // ✅ Show the actual port
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

// -------------------- Global Error Handler --------------------
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

// ✅ CRITICAL FIX: Listen on 0.0.0.0 and use Render's PORT
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 ================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 API Base URL: http://localhost:${PORT}/api`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api`);
  console.log('🚀 ================================');

  // Log configuration in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Configuration:');
    console.log(`   - CORS Origins: ${allowedOrigins.join(', ')}`);
    console.log(`   - Rate Limit: ${process.env.RATE_LIMIT_REQUESTS || 100}/15min`);
    console.log(`   - AI Rate Limit: ${process.env.AI_RATE_LIMIT_REQUESTS || 50}/hour`);
    console.log(
      `   - GitHub OAuth: ${!!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)}`
    );
    console.log(`   - Gemini API: ${!!process.env.GEMINI_API_KEY}`);
  }

  // ✅ Log the actual port being used (for debugging)
  console.log(`✅ Server successfully bound to port ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);

  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

module.exports = app;

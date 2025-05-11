// backend/src/app.ts
import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet'; // Security middleware
import rateLimit from 'express-rate-limit'; // Rate limiting
import hpp from 'hpp'; // HTTP Parameter Pollution protection
import config from './config/default';
import authRoutes from './routes/auth.routes';
import onboardingRoutes from './routes/onboarding.routes';
import verificationRoutes from './routes/verification.routes';
import adminRoutes from './routes/admin.routes';
import commerceRoutes from './modules/commerce'; // New commerce routes
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';

const app: Application = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' } // Allow cross-origin resource sharing for images
  })
);

// HTTP Parameter Pollution protection
app.use(hpp());

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// More aggressive rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later'
});

// Body-parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** Fully open CORS configuration for local development ***
app.use(cors()); // <-- allows requests from any origin at any time

// Serve static files from the uploads directory - BOTH WITH AND WITHOUT /api prefix
const staticFileOpts = {
  setHeaders: (res: express.Response) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
  }
};

// Serve from /uploads (for new images)
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'), staticFileOpts)
);

// Also serve from /api/uploads (for existing images)
app.use(
  '/api/uploads',
  express.static(path.join(__dirname, '../uploads'), staticFileOpts)
);

// API Routes with rate limits where needed
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/admin', adminRoutes);

// Add new commerce routes
app.use('/api', commerceRoutes);

// In production, serve the frontend
if (process.env.NODE_ENV === 'production') {
  // Serve static files
  app.use(express.static(path.join(__dirname, '../../frontend/out')));

  // All other requests go to the React app
  app.get('*', (req, res) => {
    res.sendFile(
      path.resolve(__dirname, '../../frontend/out/index.html')
    );
  });
}

// Error handling middleware - use 'as any' to bypass TypeScript strict checking
// This is an acceptable workaround for Express middleware in TypeScript
app.use(notFoundHandler as any);
app.use(errorHandler as any);

export default app;

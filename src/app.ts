import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger';
// Modules
import healthRouter from './modules/health/health.routes';
import catalogRouter from './modules/catalog/catalog.routes';
import pricingRouter from './modules/pricing/pricing.routes';
import areasRouter from './modules/areas/areas.routes';
import bookingsRouter from './modules/bookings/bookings.routes';
import contactRouter from './modules/contact/contact.routes';
import blogRouter from './modules/blog/blog.routes';
import settingsRouter from './modules/settings/settings.routes';
import adminRouter from './modules/admin/admin.routes';
import authRouter from './modules/auth/auth.routes';
import mediaRouter, { UPLOAD_DIR } from './modules/media/media.routes';

export function createApp(): Express {
  const app = express();

  // Security Headers
  // Behind a reverse proxy (nginx / Docker) so rate limits see the real client IP
  app.set('trust proxy', 1);
  app.use(helmet());

  // CORS Configuration
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,https://focusfix.net,https://admin.focusfix.net').split(',');
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true,
    })
  );

  // Uploaded images (catalog, blog). Cross-origin so the site and dashboard can embed them.
  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      maxAge: '365d',
      immutable: true,
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    })
  );

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global Rate Limiting
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use(globalLimiter);

  // Stricter limits on public writes and login to slow down spam / brute force
  const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'محاولات كثيرة، يرجى المحاولة لاحقاً.' },
  });
  app.post('/api/v1/bookings', writeLimiter);
  app.post('/api/v1/contact', writeLimiter);
  app.post('/api/v1/contact/quotes', writeLimiter);
  app.post('/api/v1/auth/login', writeLimiter);

  // API v1 Routes
  const apiV1 = express.Router();
  apiV1.use('/health', healthRouter);
  apiV1.use('/catalog', catalogRouter);
  apiV1.use('/pricing', pricingRouter);
  apiV1.use('/areas', areasRouter);
  apiV1.use('/bookings', bookingsRouter);
  apiV1.use('/contact', contactRouter);
  apiV1.use('/blog', blogRouter);
  apiV1.use('/settings', settingsRouter);
  apiV1.use('/admin', adminRouter);
  apiV1.use('/auth', authRouter);
  apiV1.use('/media', mediaRouter);

  app.use('/api/v1', apiV1);

  // Global 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  });

  // Global Error Handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error({ err, path: req.path }, 'Unhandled error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}

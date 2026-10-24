import { Router } from 'express';
import { requireAuth } from './auth.middleware';
import { authController } from './auth.controller';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', (req, res) => authController.login(req, res));

// POST /api/v1/auth/refresh
router.post('/refresh', (req, res) => authController.refresh(req, res));

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => authController.logout(req, res));

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => authController.getMe(req, res));

export default router;

import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { adminController } from './admin.controller';

const router = Router();

// GET /api/v1/admin/badges (Polling every 30s)
router.get('/badges', (req, res) => adminController.getBadges(req, res));

// GET /api/v1/admin/stats
router.get('/stats', requireAuth, (req, res) => adminController.getStats(req, res));

// GET /api/v1/admin/audit-log
router.get('/audit-log', requireAuth, (req, res) => adminController.getAuditLog(req, res));

export default router;

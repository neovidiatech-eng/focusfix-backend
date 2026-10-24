import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { settingsController } from './settings.controller';

const router = Router();

// PUBLIC: GET /api/v1/settings/public
router.get('/public', (req, res) => settingsController.getPublicSettings(req, res));

// ADMIN: GET /api/v1/settings/admin
router.get('/admin', requireAuth, (req, res) => settingsController.getAdminSettings(req, res));

// ADMIN: PUT /api/v1/settings/admin (Bulk update)
router.put('/admin', requireAuth, (req, res) => settingsController.updateAdminSettings(req, res));

export default router;

import { Router } from 'express';
import { catalogController } from './catalog.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// Public routes
// GET /api/v1/catalog/device-types
router.get('/device-types', (req, res) => catalogController.getDeviceTypes(req, res));

// GET /api/v1/catalog/models?type=iphone
router.get('/models', (req, res) => catalogController.getModels(req, res));

// GET /api/v1/catalog/services
router.get('/services', (req, res) => catalogController.getServices(req, res));

// Admin routes (Protected)
router.post('/admin/models', requireAuth as any, (req, res) => catalogController.createModel(req, res));
router.put('/admin/models/:id', requireAuth as any, (req, res) => catalogController.updateModel(req, res));
router.delete('/admin/models/:id', requireAuth as any, (req, res) => catalogController.deleteModel(req, res));

router.post('/admin/services', requireAuth as any, (req, res) => catalogController.createService(req, res));
router.delete('/admin/services/:id', requireAuth as any, (req, res) => catalogController.deleteService(req, res));

export default router;

import { Router } from 'express';
import { catalogController } from './catalog.controller';

const router = Router();

// GET /api/v1/catalog/device-types
router.get('/device-types', (req, res) => catalogController.getDeviceTypes(req, res));

// GET /api/v1/catalog/models?type=iphone
router.get('/models', (req, res) => catalogController.getModels(req, res));

// GET /api/v1/catalog/services
router.get('/services', (req, res) => catalogController.getServices(req, res));

export default router;

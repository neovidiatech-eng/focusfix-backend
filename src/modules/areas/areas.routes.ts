import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { areasController } from './areas.controller';

const router = Router();

// PUBLIC: GET /api/v1/areas
router.get('/', (req, res) => areasController.getAreas(req, res));

// PUBLIC: GET /api/v1/areas/:slug
router.get('/:slug', (req, res) => areasController.getAreaBySlug(req, res));

// ADMIN: POST /api/v1/areas/admin
router.post('/admin', requireAuth, (req, res) => areasController.createArea(req, res));

// ADMIN: PUT /api/v1/areas/admin/:id
router.put('/admin/:id', requireAuth, (req, res) => areasController.updateArea(req, res));

// ADMIN: DELETE /api/v1/areas/admin/:id
router.delete('/admin/:id', requireAuth, (req, res) => areasController.deleteArea(req, res));

// ADMIN: GET /api/v1/areas/admin/:id/slots
router.get('/admin/:id/slots', requireAuth, (req, res) => areasController.getAreaSlots(req, res));

// ADMIN: POST /api/v1/areas/admin/exceptions
router.post('/admin/exceptions', requireAuth, (req, res) => areasController.createSlotException(req, res));

export default router;

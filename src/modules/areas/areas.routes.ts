import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { areasController } from './areas.controller';

const router = Router();

// PUBLIC: GET /api/v1/areas
router.get('/', (req, res) => areasController.getAreas(req, res));

// ADMIN: GET /api/v1/areas/admin/all (includes inactive areas)
router.get('/admin/all', requireAuth, (req, res) => areasController.getAdminAreas(req, res));

// ADMIN: POST /api/v1/areas/admin
router.post('/admin', requireAuth, (req, res) => areasController.createArea(req, res));

// ADMIN: POST /api/v1/areas/admin/exceptions
router.post('/admin/exceptions', requireAuth, (req, res) => areasController.createSlotException(req, res));

// ADMIN: DELETE /api/v1/areas/admin/exceptions/:exceptionId
router.delete('/admin/exceptions/:exceptionId', requireAuth, (req, res) => areasController.deleteSlotException(req, res));

// ADMIN: PUT /api/v1/areas/admin/:id
router.put('/admin/:id', requireAuth, (req, res) => areasController.updateArea(req, res));

// ADMIN: DELETE /api/v1/areas/admin/:id
router.delete('/admin/:id', requireAuth, (req, res) => areasController.deleteArea(req, res));

// ADMIN: GET / PUT /api/v1/areas/admin/:id/slots
router.get('/admin/:id/slots', requireAuth, (req, res) => areasController.getAreaSlots(req, res));
router.put('/admin/:id/slots', requireAuth, (req, res) => areasController.replaceAreaSlots(req, res));

// ADMIN: GET /api/v1/areas/admin/:id/exceptions (upcoming closures / overrides)
router.get('/admin/:id/exceptions', requireAuth, (req, res) => areasController.getSlotExceptions(req, res));

// PUBLIC: GET /api/v1/areas/:slug
router.get('/:slug', (req, res) => areasController.getAreaBySlug(req, res));

export default router;

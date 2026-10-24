import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { pricingController } from './pricing.controller';

const router = Router();

// PUBLIC: GET /api/v1/pricing?type=iphone
router.get('/', (req, res) => pricingController.getPublicMatrix(req, res));

// ADMIN: GET /api/v1/pricing/admin/matrix
router.get('/admin/matrix', requireAuth, (req, res) => pricingController.getAdminMatrix(req, res));

// ADMIN: PUT /api/v1/pricing/admin/matrix (Bulk Update)
router.put('/admin/matrix', requireAuth, (req, res) => pricingController.bulkUpdateMatrix(req, res));

// ADMIN: POST /api/v1/pricing/admin/import (Excel Import with Dry Run)
router.post('/admin/import', requireAuth, (req, res) => pricingController.importPrices(req, res));

export default router;

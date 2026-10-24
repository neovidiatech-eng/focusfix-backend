import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { contactController } from './contact.controller';

const router = Router();

// PUBLIC: POST /api/v1/contact
router.post('/', (req, res) => contactController.submitContact(req, res));

// PUBLIC: POST /api/v1/contact/quotes
router.post('/quotes', (req, res) => contactController.submitQuote(req, res));

// ADMIN: GET /api/v1/contact/admin/messages
router.get('/admin/messages', requireAuth, (req, res) => contactController.getMessages(req, res));

// ADMIN: GET /api/v1/contact/admin/quotes
router.get('/admin/quotes', requireAuth, (req, res) => contactController.getQuotes(req, res));

// ADMIN: PATCH /api/v1/contact/admin/messages/:id/status
router.patch('/admin/messages/:id/status', requireAuth, (req, res) => contactController.updateMessageStatus(req, res));

export default router;

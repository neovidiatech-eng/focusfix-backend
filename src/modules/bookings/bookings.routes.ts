import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { bookingsController } from './bookings.controller';

const router = Router();

// PUBLIC: GET /api/v1/bookings/availability
router.get('/availability', (req, res) => bookingsController.getAvailability(req, res));

// PUBLIC: POST /api/v1/bookings
router.post('/', (req, res) => bookingsController.createBooking(req, res));

// PUBLIC: GET /api/v1/bookings/confirmation/:token
router.get('/confirmation/:token', (req, res) => bookingsController.getConfirmation(req, res));
router.get('/track', (req, res) => bookingsController.trackBooking(req, res));

// ADMIN: GET /api/v1/bookings/admin/all
router.get('/admin/all', requireAuth, (req, res) => bookingsController.getAllAdminBookings(req, res));

// ADMIN: GET /api/v1/bookings/admin/:id
router.get('/admin/:id', requireAuth, (req, res) => bookingsController.getAdminBookingById(req, res));

// ADMIN: PATCH /api/v1/bookings/admin/:id/status
router.patch('/admin/:id/status', requireAuth, (req, res) => bookingsController.updateBookingStatus(req, res));

// ADMIN: PATCH /api/v1/bookings/admin/:id/notes
router.patch('/admin/:id/notes', requireAuth, (req, res) => bookingsController.updateBookingNotes(req, res));

export default router;

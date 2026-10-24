import { Request, Response } from 'express';
import { z } from 'zod';
import { bookingsService } from './bookings.service';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { logger } from '../../lib/logger';

export const createBookingSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^(\+20|0)?1[0125][0-9]{8}$/),
  whatsappNumber: z.string().optional(),
  email: z.string().email(),
  modelId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  areaId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  slotDate: z.string(), // YYYY-MM-DD
  slotLabel: z.string(),
  address: z.string().min(5),
  propertyType: z.string().optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
  notes: z.string().optional(),
  termsAccepted: z.literal(true),
  attribution: z.record(z.any()).optional(),
  turnstileToken: z.string().optional(),
});

export class BookingsController {
  async getAvailability(req: Request, res: Response) {
    try {
      const { area_id } = req.query;
      if (!area_id) {
        return res.status(400).json({ error: 'area_id is required' });
      }

      const availability = await bookingsService.getAvailability(String(area_id));
      res.json(availability);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch availability' });
    }
  }

  async createBooking(req: Request, res: Response) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        const existing = await bookingsService.checkExistingIdempotency(idempotencyKey);
        if (existing) {
          return res.json({
            bookingNumber: existing.booking_number,
            status: existing.status,
            confirmationToken: existing.confirmation_token,
            alreadyProcessed: true,
          });
        }
      }

      const validated = createBookingSchema.parse(req.body);
      const result = await bookingsService.createBooking(validated as any, idempotencyKey);

      res.status(201).json({
        bookingNumber: result.bookingNumber,
        status: 'pending',
        confirmationToken: result.confirmationToken,
        estimatedTotal: result.estimatedTotal,
        message: 'Booking created successfully',
      });
    } catch (error: any) {
      logger.error({ error }, 'Error creating booking');
      res.status(400).json({ error: error.message || 'Failed to submit booking' });
    }
  }

  async getConfirmation(req: Request, res: Response) {
    try {
      const details = await bookingsService.getConfirmation(req.params.token);
      res.json(details);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: error.message || 'Failed to fetch confirmation details' });
    }
  }

  async trackBooking(req: Request, res: Response) {
    try {
      const bookingNumber = String(req.query.code || '').trim().toUpperCase();
      const phone = String(req.query.phone || '').trim();
      if (!bookingNumber || !phone) return res.status(400).json({ error: 'code and phone are required' });
      res.json(await bookingsService.trackBooking(bookingNumber, phone));
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Booking not found' });
    }
  }

  async getAllAdminBookings(req: Request, res: Response) {
    try {
      const { status, search, page = '1', limit = '20' } = req.query;
      const result = await bookingsService.getAllAdminBookings({
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
        page: parseInt(String(page), 10),
        limit: parseInt(String(limit), 10),
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admin bookings' });
    }
  }

  async getAdminBookingById(req: Request, res: Response) {
    try {
      const booking = await bookingsService.getAdminBookingById(req.params.id);
      res.json(booking);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Booking not found' });
    }
  }

  async updateBookingStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, note, totalFinal } = req.body;
      const updated = await bookingsService.updateBookingStatus(
        req.params.id,
        { status, note, totalFinal },
        req.user?.email
      );
      res.json({ success: true, booking: updated });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update booking status' });
    }
  }

  async updateBookingNotes(req: Request, res: Response) {
    try {
      const { notes } = req.body;
      const b = await bookingsService.updateBookingNotes(req.params.id, notes);
      res.json({ success: true, notes: b.notes });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update notes' });
    }
  }
}

export const bookingsController = new BookingsController();

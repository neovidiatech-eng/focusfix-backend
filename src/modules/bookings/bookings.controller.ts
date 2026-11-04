import { sendError } from '../../lib/errors';
import { Request, Response } from 'express';
import { z } from 'zod';
import { BookingStatus } from '@prisma/client';
import { bookingsService, BOOKING_STATUSES } from './bookings.service';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { logger } from '../../lib/logger';
import { notifyNewBooking } from '../../lib/notify';

export const createBookingSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^(\+20|0)?1[0125][0-9]{8}$/),
  whatsappNumber: z.string().optional(),
  // Optional: phone is enough to confirm; email only adds the confirmation mail
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email().optional()),
  modelId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1),
  areaId: z.string().uuid(),
  slotId: z.string().uuid().optional(),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
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

const updateStatusSchema = z.object({
  status: z.enum(BOOKING_STATUSES as [BookingStatus, ...BookingStatus[]]),
  note: z.string().max(1000).optional(),
  totalFinal: z.number().nonnegative().nullable().optional(),
});

export class BookingsController {
  async getAvailability(req: Request, res: Response) {
    try {
      const { area_id, date } = req.query;
      if (!area_id) {
        return res.status(400).json({ error: 'area_id is required' });
      }

      if (req.query.from) {
        return res.json(await bookingsService.getAvailabilityDays(String(area_id), String(req.query.from), Number(req.query.days) || 7));
      }

      const availability = await bookingsService.getAvailability(String(area_id), date ? String(date) : undefined);
      res.json(availability);
    } catch (error: any) {
      const status = error.message?.includes('YYYY-MM-DD') || error.message?.includes('Invalid area') ? 400 : 500;
      res.status(status).json({ error: status === 400 ? error.message : 'Failed to fetch availability' });
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
      notifyNewBooking(result.newBooking.id).catch(() => {});

      res.status(201).json({
        bookingNumber: result.bookingNumber,
        status: 'pending',
        confirmationToken: result.confirmationToken,
        estimatedTotal: result.estimatedTotal,
        message: 'Booking created successfully',
      });
    } catch (error: any) {
      logger.error({ error }, 'Error creating booking');
      sendError(res, error, 'Failed to submit booking', 400);
    }
  }

  async getConfirmation(req: Request, res: Response) {
    try {
      const details = await bookingsService.getConfirmation(req.params.token);
      res.json(details);
    } catch (error: any) {
      sendError(res, error, 'Failed to fetch confirmation details', 404);
    }
  }

  async trackBooking(req: Request, res: Response) {
    try {
      const bookingNumber = String(req.query.code || '').trim().toUpperCase();
      const phone = String(req.query.phone || '').trim();
      if (!bookingNumber || !phone) return res.status(400).json({ error: 'code and phone are required' });
      res.json(await bookingsService.trackBooking(bookingNumber, phone));
    } catch (error: any) {
      sendError(res, error, 'Booking not found', 404);
    }
  }

  async getAllAdminBookings(req: Request, res: Response) {
    try {
      const q = req.query;
      const str = (v: unknown) => (v ? String(v) : undefined);
      const result = await bookingsService.getAllAdminBookings({
        status: str(q.status),
        search: str(q.search),
        areaId: str(q.area_id),
        dateFrom: str(q.date_from),
        dateTo: str(q.date_to),
        dateField: q.date_field === 'created' ? 'created' : 'slot',
        page: parseInt(String(q.page || '1'), 10) || 1,
        limit: parseInt(String(q.limit || '20'), 10) || 20,
      });
      res.json(result);
    } catch (error) {
      sendError(res, error, 'Failed to fetch admin bookings');
    }
  }

  async getAdminBookingById(req: Request, res: Response) {
    try {
      const booking = await bookingsService.getAdminBookingById(req.params.id);
      res.json(booking);
    } catch (error: any) {
      sendError(res, error, 'Booking not found', 404);
    }
  }

  async updateBookingStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const data = updateStatusSchema.parse(req.body);
      const updated = await bookingsService.updateBookingStatus(req.params.id, data, req.user?.email);
      res.json({ success: true, booking: updated });
    } catch (error: any) {
      sendError(res, error, 'Failed to update booking status', 400);
    }
  }

  async updateBookingNotes(req: AuthenticatedRequest, res: Response) {
    try {
      const { notes } = z.object({ notes: z.string().max(5000).nullable().optional() }).parse(req.body);
      const b = await bookingsService.updateBookingNotes(req.params.id, notes?.trim() || null, req.user?.email);
      res.json({ success: true, internalNotes: b.internal_notes });
    } catch (error) {
      sendError(res, error, 'Failed to update notes');
    }
  }
}

export const bookingsController = new BookingsController();

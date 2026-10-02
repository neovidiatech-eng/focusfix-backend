import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';

const router = Router();

// Validation Schema for Booking Submission
const createBookingSchema = z.object({
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

// GET /api/v1/bookings/availability?area_id=&from=&to=
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const { area_id, from, to } = req.query;
    if (!area_id) {
      return res.status(400).json({ error: 'area_id is required' });
    }

    const slots = await prisma.timeSlot.findMany({
      where: { area_id: String(area_id), is_active: true },
      orderBy: { start_time: 'asc' },
    });

    res.json({
      areaId: area_id,
      slots: slots.map((s) => ({
        id: s.id,
        startTime: s.start_time,
        endTime: s.end_time,
        label: `${s.start_time} - ${s.end_time}`,
        maxBookings: s.max_bookings,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST /api/v1/bookings
router.post('/', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey) {
      const existing = await prisma.booking.findUnique({
        where: { idempotency_key: idempotencyKey },
        include: { model: true, area: true },
      });
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

    // Format phone to E.164 (+201...)
    let cleanPhone = validated.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '20' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    // Transaction for booking creation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch area and transport fee
      const area = await tx.area.findUnique({ where: { id: validated.areaId } });
      if (!area || !area.is_active) throw new Error('Selected area is invalid');

      // 2. Fetch prices for services
      const prices = await tx.price.findMany({
        where: {
          model_id: validated.modelId,
          service_id: { in: validated.serviceIds },
          status: { in: ['available', 'on_request'] },
        },
        include: { service: true },
      });

      let servicesTotal = 0;
      const serviceSnapshots = prices.map((p) => {
        const effectivePrice = Number(p.discount_price || p.price || 0);
        const isPending = p.status === 'on_request';
        if (!isPending) servicesTotal += effectivePrice;

        return {
          service_id: p.service_id,
          price_snapshot: effectivePrice,
          discount_snapshot: p.discount_price,
          warranty_days_snapshot: p.warranty_days,
          minutes_snapshot: p.service.estimated_minutes,
          price_pending: isPending,
        };
      });

      const transportFee = Number(area.transport_fee || 0);
      const estimatedTotal = servicesTotal + transportFee;

      // 3. Upsert customer
      const customer = await tx.customer.upsert({
        where: { phone: cleanPhone },
        update: { name: validated.name, email: validated.email },
        create: { phone: cleanPhone, name: validated.name, email: validated.email },
      });

      // 4. Generate sequential booking number FM-YYYY-XXXXX
      const currentYear = new Date().getFullYear();
      const counter = await tx.counter.upsert({
        where: { year: currentYear },
        update: { value: { increment: 1 } },
        create: { year: currentYear, value: 101 },
      });
      const bookingNumber = `FM-${currentYear}-${String(counter.value).padStart(5, '0')}`;
      const confirmationToken = crypto.randomBytes(24).toString('hex');

      // 5. Create booking
      const newBooking = await tx.booking.create({
        data: {
          booking_number: bookingNumber,
          customer_id: customer.id,
          model_id: validated.modelId,
          area_id: validated.areaId,
          slot_id: validated.slotId,
          slot_date: new Date(validated.slotDate),
          slot_label_snapshot: validated.slotLabel,
          address: validated.address,
          property_type: validated.propertyType || 'home',
          location_lat: validated.locationLat,
          location_lng: validated.locationLng,
          transport_fee_snapshot: transportFee,
          services_total: servicesTotal,
          estimated_total: estimatedTotal,
          notes: validated.notes,
          whatsapp_number: validated.whatsappNumber || cleanPhone,
          attribution: validated.attribution || {},
          idempotency_key: idempotencyKey,
          confirmation_token: confirmationToken,
          services: {
            create: serviceSnapshots,
          },
          events: {
            create: {
              status: 'pending',
              note: 'تم إنشاء الحجز بنجاح عبر الموقع',
              created_by: 'system',
            },
          },
        },
      });

      return { newBooking, bookingNumber, confirmationToken, estimatedTotal };
    });

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
});

// GET /api/v1/bookings/confirmation/:token
router.get('/confirmation/:token', async (req: Request, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { confirmation_token: req.params.token },
      include: {
        model: true,
        area: true,
        services: { include: { service: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking confirmation not found' });
    }

    res.json({
      bookingNumber: booking.booking_number,
      device: booking.model.name,
      area: booking.area.name_ar,
      slotLabel: booking.slot_label_snapshot,
      slotDate: booking.slot_date,
      transportFee: booking.transport_fee_snapshot,
      estimatedTotal: booking.estimated_total,
      status: booking.status,
      services: booking.services.map((s) => ({
        name: s.service.name_ar,
        price: s.price_snapshot,
        warrantyDays: s.warranty_days_snapshot,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch confirmation details' });
  }
});

export default router;

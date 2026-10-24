import crypto from 'crypto';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface CreateBookingDTO {
  name: string;
  phone: string;
  whatsappNumber?: string;
  email: string;
  modelId: string;
  serviceIds: string[];
  areaId: string;
  slotId?: string;
  slotDate: string;
  slotLabel: string;
  address: string;
  propertyType?: string;
  locationLat?: number;
  locationLng?: number;
  notes?: string;
  termsAccepted: true;
  attribution?: any;
  turnstileToken?: string;
}

export class BookingsService {
  async getAvailability(areaId: string) {
    const slots = await prisma.timeSlot.findMany({
      where: { area_id: areaId, is_active: true },
      orderBy: { start_time: 'asc' },
    });

    return {
      areaId,
      slots: slots.map((s) => ({
        id: s.id,
        startTime: s.start_time,
        endTime: s.end_time,
        label: `${s.start_time} - ${s.end_time}`,
        maxBookings: s.max_bookings,
      })),
    };
  }

  async checkExistingIdempotency(idempotencyKey?: string) {
    if (!idempotencyKey) return null;
    return prisma.booking.findUnique({
      where: { idempotency_key: idempotencyKey },
      include: { model: true, area: true },
    });
  }

  async createBooking(data: CreateBookingDTO, idempotencyKey?: string) {
    let cleanPhone = data.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '20' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;

    return prisma.$transaction(async (tx) => {
      const area = await tx.area.findUnique({ where: { id: data.areaId } });
      if (!area || !area.is_active) throw new Error('Selected area is invalid');

      const prices = await tx.price.findMany({
        where: {
          model_id: data.modelId,
          service_id: { in: data.serviceIds },
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

      const customer = await tx.customer.upsert({
        where: { phone: cleanPhone },
        update: { name: data.name, email: data.email },
        create: { phone: cleanPhone, name: data.name, email: data.email },
      });

      const currentYear = new Date().getFullYear();
      const counter = await tx.counter.upsert({
        where: { year: currentYear },
        update: { value: { increment: 1 } },
        create: { year: currentYear, value: 101 },
      });
      const bookingNumber = `FM-${currentYear}-${String(counter.value).padStart(5, '0')}`;
      const confirmationToken = crypto.randomBytes(24).toString('hex');

      const newBooking = await tx.booking.create({
        data: {
          booking_number: bookingNumber,
          customer_id: customer.id,
          model_id: data.modelId,
          area_id: data.areaId,
          slot_id: data.slotId,
          slot_date: new Date(data.slotDate),
          slot_label_snapshot: data.slotLabel,
          address: data.address,
          property_type: data.propertyType || 'home',
          location_lat: data.locationLat,
          location_lng: data.locationLng,
          transport_fee_snapshot: transportFee,
          services_total: servicesTotal,
          estimated_total: estimatedTotal,
          notes: data.notes,
          whatsapp_number: data.whatsappNumber || cleanPhone,
          attribution: data.attribution || {},
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
  }

  async getConfirmation(token: string) {
    const booking = await prisma.booking.findUnique({
      where: { confirmation_token: token },
      include: {
        model: true,
        area: true,
        services: { include: { service: true } },
      },
    });

    if (!booking) {
      throw new Error('Booking confirmation not found');
    }

    return {
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
    };
  }

  async trackBooking(bookingNumber: string, phone: string) {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '20' + cleanPhone.slice(1);
    if (!cleanPhone.startsWith('+')) cleanPhone = '+' + cleanPhone;
    const booking = await prisma.booking.findFirst({
      where: { booking_number: bookingNumber, customer: { phone: cleanPhone } },
      include: { model: true, area: true, services: { include: { service: true } } },
    });
    if (!booking) throw new Error('Booking not found');
    return {
      bookingNumber: booking.booking_number,
      status: booking.status,
      device: booking.model.name,
      area: booking.area.name_ar,
      slotDate: booking.slot_date,
      slotLabel: booking.slot_label_snapshot,
      services: booking.services.map((s) => ({ name: s.service.name_ar, price: s.price_snapshot, warrantyDays: s.warranty_days_snapshot })),
      transportFee: booking.transport_fee_snapshot,
      estimatedTotal: booking.total_final || booking.estimated_total,
    };
  }

  async getAllAdminBookings(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = params;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search) {
      const q = String(search);
      where.OR = [
        { booking_number: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q } } },
      ];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          customer: true,
          model: true,
          area: true,
          services: { include: { service: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: bookings,
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getAdminBookingById(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        model: { include: { type: true } },
        area: true,
        services: { include: { service: true } },
        events: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }

  async updateBookingStatus(
    id: string,
    data: { status: string; note?: string; totalFinal?: number },
    adminEmail?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id },
        data: {
          status: data.status as BookingStatus,
          total_final: data.totalFinal ? Number(data.totalFinal) : undefined,
        },
      });

      await tx.bookingEvent.create({
        data: {
          booking_id: b.id,
          status: data.status,
          note: data.note || `تغيرت حالة الحجز إلى: ${data.status}`,
          created_by: adminEmail || 'admin',
        },
      });

      return b;
    });
  }

  async updateBookingNotes(id: string, notes?: string) {
    return prisma.booking.update({
      where: { id },
      data: { notes },
    });
  }
}

export const bookingsService = new BookingsService();

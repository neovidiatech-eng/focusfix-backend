import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/errors';
import { triggerRevalidation } from '../../lib/revalidate';

// Default weekly schedule for new areas (same as the seed): 3 slots a day
const DEFAULT_SLOT_TIMES = [
  { start: '10:00', end: '13:00' },
  { start: '13:00', end: '16:00' },
  { start: '16:00', end: '19:00' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface AreaInput {
  name_ar?: string;
  name_en?: string;
  slug?: string;
  city_ar?: string;
  city_en?: string;
  transport_fee?: number;
  order?: number;
  is_active?: boolean;
  intro_ar?: string | null;
  intro_en?: string | null;
  seo_title?: string | null;
  seo_desc?: string | null;
}

export interface SlotInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_bookings: number;
  is_active?: boolean;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function defaultSlotCapacity() {
  const setting = await prisma.setting.findUnique({ where: { key: 'slot_capacity' } });
  const value = parseInt(setting?.value || '3', 10);
  return Number.isFinite(value) && value > 0 ? value : 3;
}

export class AreasService {
  async getActiveAreas() {
    return prisma.area.findMany({
      where: { is_active: true },
      orderBy: [{ order: 'asc' }, { name_ar: 'asc' }],
    });
  }

  /** Dashboard list: every area, with slot and booking counts */
  async getAdminAreas() {
    return prisma.area.findMany({
      orderBy: [{ order: 'asc' }, { name_ar: 'asc' }],
      include: {
        _count: { select: { bookings: true, time_slots: true } },
      },
    });
  }

  async getAreaBySlug(slug: string) {
    const area = await prisma.area.findUnique({
      where: { slug },
      include: { time_slots: { where: { is_active: true }, orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }] } },
    });

    if (!area || !area.is_active) {
      throw new HttpError(404, 'المنطقة غير موجودة');
    }

    return area;
  }

  async createArea(data: AreaInput) {
    if (!data.name_ar?.trim()) throw new HttpError(400, 'اسم المنطقة مطلوب');
    const slug = slugify(data.slug || data.name_en || data.name_ar);
    if (!slug) throw new HttpError(400, 'الرابط (slug) غير صالح');
    const capacity = await defaultSlotCapacity();

    const area = await prisma.area.create({
      data: {
        name_ar: data.name_ar.trim(),
        name_en: data.name_en?.trim() || data.name_ar.trim(),
        slug,
        city_ar: data.city_ar || 'القاهرة',
        city_en: data.city_en || 'Cairo',
        transport_fee: Number(data.transport_fee || 0),
        order: data.order !== undefined ? Number(data.order) : 0,
        is_active: data.is_active ?? true,
        intro_ar: data.intro_ar || null,
        intro_en: data.intro_en || null,
        seo_title: data.seo_title || null,
        seo_desc: data.seo_desc || null,
        time_slots: {
          create: [0, 1, 2, 3, 4, 5, 6].flatMap((day) =>
            DEFAULT_SLOT_TIMES.map((t) => ({ day_of_week: day, start_time: t.start, end_time: t.end, max_bookings: capacity }))
          ),
        },
      },
    });

    triggerRevalidation(['areas'], [`/areas/${area.slug}`]).catch(() => {});
    return area;
  }

  async updateArea(id: string, data: AreaInput) {
    const existing = await prisma.area.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, 'المنطقة غير موجودة');

    const area = await prisma.area.update({
      where: { id },
      data: {
        name_ar: data.name_ar?.trim() || undefined,
        name_en: data.name_en?.trim() || undefined,
        slug: data.slug ? slugify(data.slug) : undefined,
        city_ar: data.city_ar || undefined,
        city_en: data.city_en || undefined,
        transport_fee: data.transport_fee !== undefined ? Number(data.transport_fee) : undefined,
        order: data.order !== undefined ? Number(data.order) : undefined,
        is_active: data.is_active,
        intro_ar: data.intro_ar !== undefined ? data.intro_ar || null : undefined,
        intro_en: data.intro_en !== undefined ? data.intro_en || null : undefined,
        seo_title: data.seo_title !== undefined ? data.seo_title || null : undefined,
        seo_desc: data.seo_desc !== undefined ? data.seo_desc || null : undefined,
      },
    });

    triggerRevalidation(['areas', 'prices'], [`/areas/${existing.slug}`, `/areas/${area.slug}`]).catch(() => {});
    return area;
  }

  async deleteArea(id: string) {
    const bookings = await prisma.booking.count({ where: { area_id: id } });
    if (bookings > 0) {
      throw new HttpError(409, `لا يمكن حذف المنطقة لأن عليها ${bookings} حجز. يمكنك إيقافها بدلاً من الحذف.`);
    }

    // Slots and exceptions belong to the area
    const area = await prisma.$transaction(async (tx) => {
      await tx.slotException.deleteMany({ where: { OR: [{ area_id: id }, { slot: { area_id: id } }] } });
      await tx.timeSlot.deleteMany({ where: { area_id: id } });
      return tx.area.delete({ where: { id } });
    });
    triggerRevalidation(['areas', 'prices'], [`/areas/${area.slug}`]).catch(() => {});
    return area;
  }

  async getAreaSlots(areaId: string) {
    return prisma.timeSlot.findMany({
      where: { area_id: areaId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  /**
   * Replaces an area's weekly schedule. Slots that have bookings are deactivated
   * instead of deleted so booking history keeps its reference.
   */
  async replaceAreaSlots(areaId: string, slots: SlotInput[]) {
    for (const s of slots) {
      if (!Number.isInteger(s.day_of_week) || s.day_of_week < 0 || s.day_of_week > 6) throw new HttpError(400, 'يوم غير صالح');
      if (!TIME_RE.test(s.start_time) || !TIME_RE.test(s.end_time) || s.start_time >= s.end_time) {
        throw new HttpError(400, `وقت غير صالح: ${s.start_time} - ${s.end_time}`);
      }
      if (!Number.isInteger(s.max_bookings) || s.max_bookings < 0 || s.max_bookings > 100) throw new HttpError(400, 'سعة غير صالحة');
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.timeSlot.findMany({ where: { area_id: areaId }, include: { _count: { select: { bookings: true } } } });
      const keyOf = (s: { day_of_week: number; start_time: string; end_time: string }) => `${s.day_of_week}|${s.start_time}|${s.end_time}`;
      const incoming = new Map(slots.map((s) => [keyOf(s), s]));

      for (const slot of existing) {
        const match = incoming.get(keyOf(slot));
        if (match) {
          await tx.timeSlot.update({
            where: { id: slot.id },
            data: { max_bookings: match.max_bookings, is_active: match.is_active ?? true },
          });
          incoming.delete(keyOf(slot));
        } else if (slot._count.bookings > 0) {
          await tx.timeSlot.update({ where: { id: slot.id }, data: { is_active: false } });
        } else {
          await tx.slotException.deleteMany({ where: { slot_id: slot.id } });
          await tx.timeSlot.delete({ where: { id: slot.id } });
        }
      }

      if (incoming.size > 0) {
        await tx.timeSlot.createMany({
          data: [...incoming.values()].map((s) => ({
            area_id: areaId,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            max_bookings: s.max_bookings,
            is_active: s.is_active ?? true,
          })),
        });
      }
    });

    return this.getAreaSlots(areaId);
  }

  async getSlotExceptions(areaId: string) {
    const today = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())}T00:00:00.000Z`);
    return prisma.slotException.findMany({
      where: { OR: [{ area_id: areaId }, { slot: { area_id: areaId } }], date: { gte: today } },
      include: { slot: true },
      orderBy: { date: 'asc' },
    });
  }

  async createSlotException(data: {
    area_id: string;
    slot_id?: string | null;
    date: string | Date;
    is_closed?: boolean;
    max_override?: number | null;
    reason?: string;
  }) {
    if (!data.area_id || !data.date) throw new HttpError(400, 'المنطقة والتاريخ مطلوبان');
    return prisma.slotException.create({
      data: {
        area_id: data.slot_id ? null : data.area_id,
        slot_id: data.slot_id || null,
        date: new Date(data.date),
        is_closed: !!data.is_closed,
        max_override: data.max_override !== undefined && data.max_override !== null ? Number(data.max_override) : null,
        reason: data.reason,
      },
    });
  }

  async deleteSlotException(id: string) {
    return prisma.slotException.delete({ where: { id } });
  }
}

export const areasService = new AreasService();

import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';

export class AreasService {
  async getActiveAreas() {
    return prisma.area.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
  }

  async getAreaBySlug(slug: string) {
    const area = await prisma.area.findUnique({
      where: { slug },
      include: { time_slots: { where: { is_active: true } } },
    });

    if (!area) {
      throw new Error('Area not found');
    }

    return area;
  }

  async createArea(data: {
    name_ar: string;
    name_en?: string;
    slug: string;
    city_ar?: string;
    transport_fee?: number;
  }) {
    const area = await prisma.area.create({
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        slug: data.slug,
        city_ar: data.city_ar || 'القاهرة',
        transport_fee: Number(data.transport_fee || 0),
      },
    });

    triggerRevalidation(['areas']).catch(() => {});
    return area;
  }

  async updateArea(
    id: string,
    data: {
      name_ar?: string;
      name_en?: string;
      transport_fee?: number;
      is_active?: boolean;
    }
  ) {
    const area = await prisma.area.update({
      where: { id },
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en,
        transport_fee: data.transport_fee !== undefined ? Number(data.transport_fee) : undefined,
        is_active: data.is_active,
      },
    });

    triggerRevalidation(['areas', 'prices']).catch(() => {});
    return area;
  }

  async deleteArea(id: string) {
    const area = await prisma.area.delete({ where: { id } });
    triggerRevalidation(['areas', 'prices']).catch(() => {});
    return area;
  }

  async getAreaSlots(areaId: string) {
    return prisma.timeSlot.findMany({
      where: { area_id: areaId },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
  }

  async createSlotException(data: {
    area_id: string;
    date: string | Date;
    is_closed?: boolean;
    max_override?: number | null;
    reason?: string;
  }) {
    return prisma.slotException.create({
      data: {
        area_id: data.area_id,
        date: new Date(data.date),
        is_closed: !!data.is_closed,
        max_override: data.max_override ? Number(data.max_override) : null,
        reason: data.reason,
      },
    });
  }
}

export const areasService = new AreasService();

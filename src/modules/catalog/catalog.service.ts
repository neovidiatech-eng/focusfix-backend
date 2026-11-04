import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/errors';
import { triggerRevalidation } from '../../lib/revalidate';

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class CatalogService {
  async getDeviceTypes() {
    return prisma.deviceType.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
  }

  async getDeviceModels(typeSlug?: string) {
    const where: any = { is_active: true };
    if (typeSlug) {
      where.type = { slug: String(typeSlug) };
    }
    return prisma.deviceModel.findMany({
      where,
      include: { type: true },
      orderBy: { order: 'asc' },
    });
  }

  async getServices() {
    return prisma.service.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
  }

  /** Dashboard lists include inactive items so they can be re-enabled */
  async getAdminCatalog() {
    const [deviceTypes, models, services] = await Promise.all([
      prisma.deviceType.findMany({ orderBy: { order: 'asc' } }),
      prisma.deviceModel.findMany({
        include: { type: true, _count: { select: { bookings: true, prices: true } } },
        orderBy: [{ type_id: 'asc' }, { order: 'asc' }],
      }),
      prisma.service.findMany({
        include: { _count: { select: { booking_services: true, prices: true } } },
        orderBy: { order: 'asc' },
      }),
    ]);
    return { deviceTypes, models, services };
  }

  async createModel(data: {
    name: string;
    slug?: string;
    type_id: string;
    series_ar?: string;
    series_en?: string;
    release_year?: number;
    order?: number;
    image_url?: string | null;
  }) {
    if (!data.name?.trim() || !data.type_id) throw new HttpError(400, 'اسم الموديل ونوع الجهاز مطلوبان');
    const slug = slugify(data.slug || data.name);

    const model = await prisma.deviceModel.create({
      data: {
        name: data.name.trim(),
        slug,
        type_id: data.type_id,
        series_ar: data.series_ar || null,
        series_en: data.series_en || null,
        release_year: data.release_year ? Number(data.release_year) : new Date().getFullYear(),
        order: data.order !== undefined ? Number(data.order) : 0,
        image_url: data.image_url || null,
      },
    });
    triggerRevalidation(['catalog', 'prices']).catch(() => {});
    return model;
  }

  async updateModel(id: string, data: any) {
    const model = await prisma.deviceModel.update({
      where: { id },
      data: {
        ...(data.name ? { name: String(data.name).trim() } : {}),
        ...(data.slug ? { slug: slugify(data.slug) } : {}),
        ...(data.type_id ? { type_id: data.type_id } : {}),
        ...(data.series_ar !== undefined ? { series_ar: data.series_ar || null } : {}),
        ...(data.series_en !== undefined ? { series_en: data.series_en || null } : {}),
        ...(data.release_year ? { release_year: Number(data.release_year) } : {}),
        ...(data.order !== undefined ? { order: Number(data.order) } : {}),
        ...(data.image_url !== undefined ? { image_url: data.image_url || null } : {}),
        ...(typeof data.is_active === 'boolean' ? { is_active: data.is_active } : {}),
      },
    });
    triggerRevalidation(['catalog', 'prices']).catch(() => {});
    return model;
  }

  /** Device types are seeded; the dashboard edits their image, intro and visibility */
  async updateDeviceType(id: string, data: any) {
    const type = await prisma.deviceType.update({
      where: { id },
      data: {
        ...(data.name_ar ? { name_ar: String(data.name_ar).trim() } : {}),
        ...(data.name_en ? { name_en: String(data.name_en).trim() } : {}),
        ...(data.image_url !== undefined ? { image_url: data.image_url || null } : {}),
        ...(data.intro_ar !== undefined ? { intro_ar: data.intro_ar || null } : {}),
        ...(data.order !== undefined ? { order: Number(data.order) } : {}),
        ...(typeof data.is_active === 'boolean' ? { is_active: data.is_active } : {}),
        ...(typeof data.is_coming_soon === 'boolean' ? { is_coming_soon: data.is_coming_soon } : {}),
      },
    });
    triggerRevalidation(['catalog', 'prices']).catch(() => {});
    return type;
  }

  /** Models with bookings are deactivated (hidden from the site) instead of deleted */
  async deleteModel(id: string) {
    const bookings = await prisma.booking.count({ where: { model_id: id } });
    if (bookings > 0) {
      await prisma.deviceModel.update({ where: { id }, data: { is_active: false } });
      triggerRevalidation(['catalog', 'prices']).catch(() => {});
      return { deactivated: true, bookings };
    }
    await prisma.price.deleteMany({ where: { model_id: id } });
    await prisma.deviceModel.delete({ where: { id } });
    triggerRevalidation(['catalog', 'prices']).catch(() => {});
    return { deactivated: false };
  }

  async createService(data: {
    name_ar: string;
    name_en?: string;
    slug?: string;
    icon?: string;
    image_url?: string | null;
    description_ar?: string | null;
    estimated_minutes?: number;
    order?: number;
  }) {
    if (!data.name_ar?.trim()) throw new HttpError(400, 'اسم الخدمة مطلوب');
    const slug = slugify(data.slug || data.name_en || data.name_ar);

    const service = await prisma.service.create({
      data: {
        name_ar: data.name_ar.trim(),
        name_en: data.name_en?.trim() || data.name_ar.trim(),
        slug,
        icon: data.icon || undefined,
        image_url: data.image_url || null,
        description_ar: data.description_ar || null,
        estimated_minutes: data.estimated_minutes ? Number(data.estimated_minutes) : 30,
        order: data.order !== undefined ? Number(data.order) : 0,
      },
    });
    triggerRevalidation(['catalog', 'services', 'prices']).catch(() => {});
    return service;
  }

  async updateService(id: string, data: any) {
    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(data.name_ar ? { name_ar: String(data.name_ar).trim() } : {}),
        ...(data.name_en ? { name_en: String(data.name_en).trim() } : {}),
        ...(data.slug ? { slug: slugify(data.slug) } : {}),
        ...(data.icon !== undefined ? { icon: data.icon || undefined } : {}),
        ...(data.image_url !== undefined ? { image_url: data.image_url || null } : {}),
        ...(data.description_ar !== undefined ? { description_ar: data.description_ar || null } : {}),
        ...(data.estimated_minutes ? { estimated_minutes: Number(data.estimated_minutes) } : {}),
        ...(data.order !== undefined ? { order: Number(data.order) } : {}),
        ...(typeof data.is_active === 'boolean' ? { is_active: data.is_active } : {}),
      },
    });
    triggerRevalidation(['catalog', 'services', 'prices']).catch(() => {});
    return service;
  }

  /** Services with bookings are deactivated instead of deleted */
  async deleteService(id: string) {
    const bookings = await prisma.bookingService.count({ where: { service_id: id } });
    if (bookings > 0) {
      await prisma.service.update({ where: { id }, data: { is_active: false } });
      triggerRevalidation(['catalog', 'services', 'prices']).catch(() => {});
      return { deactivated: true, bookings };
    }
    await prisma.price.deleteMany({ where: { service_id: id } });
    await prisma.service.delete({ where: { id } });
    triggerRevalidation(['catalog', 'services', 'prices']).catch(() => {});
    return { deactivated: false };
  }
}

export const catalogService = new CatalogService();

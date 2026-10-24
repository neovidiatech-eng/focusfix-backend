import { prisma } from '../../lib/prisma';

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

  async createModel(data: {
    name: string;
    slug?: string;
    type_id: string;
    series_ar?: string;
    series_en?: string;
    release_year?: number;
  }) {
    const slug = (data.slug || data.name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-|-$/g, '');

    return prisma.deviceModel.create({
      data: {
        name: data.name,
        slug,
        type_id: data.type_id,
        series_ar: data.series_ar || null,
        series_en: data.series_en || null,
        release_year: data.release_year ? Number(data.release_year) : 2024,
      },
    });
  }

  async updateModel(id: string, data: any) {
    return prisma.deviceModel.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.slug ? { slug: data.slug } : {}),
        ...(data.type_id ? { type_id: data.type_id } : {}),
        ...(data.series_ar !== undefined ? { series_ar: data.series_ar } : {}),
        ...(data.series_en !== undefined ? { series_en: data.series_en } : {}),
        ...(data.release_year ? { release_year: Number(data.release_year) } : {}),
      },
    });
  }

  async deleteModel(id: string) {
    await prisma.price.deleteMany({ where: { model_id: id } });
    return prisma.deviceModel.delete({ where: { id } });
  }

  async createService(data: {
    name_ar: string;
    name_en?: string;
    slug?: string;
    estimated_minutes?: number;
  }) {
    const slug = (data.slug || data.name_en || data.name_ar)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
      .replace(/^-|-$/g, '');

    return prisma.service.create({
      data: {
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        slug,
        estimated_minutes: data.estimated_minutes ? Number(data.estimated_minutes) : 30,
      },
    });
  }

  async deleteService(id: string) {
    await prisma.price.deleteMany({ where: { service_id: id } });
    return prisma.service.delete({ where: { id } });
  }
}

export const catalogService = new CatalogService();

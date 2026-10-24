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
}

export const catalogService = new CatalogService();

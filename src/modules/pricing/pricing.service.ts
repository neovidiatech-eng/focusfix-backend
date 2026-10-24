import { prisma } from '../../lib/prisma';
import { PriceStatus } from '@prisma/client';
import { triggerRevalidation } from '../../lib/revalidate';

export class PricingService {
  async getPublicMatrix(typeSlug = 'iphone') {
    const deviceType = await prisma.deviceType.findUnique({
      where: { slug: typeSlug },
    });

    if (!deviceType) {
      throw new Error('Device type not found');
    }

    const services = await prisma.service.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });

    const models = await prisma.deviceModel.findMany({
      where: { type_id: deviceType.id, is_active: true },
      include: {
        prices: {
          include: { service: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    const seriesMap: Record<string, any[]> = {};

    models.forEach((model) => {
      const seriesKey = model.series_ar || 'أخرى';
      if (!seriesMap[seriesKey]) {
        seriesMap[seriesKey] = [];
      }

      const cells: Record<string, any> = {};
      model.prices.forEach((priceItem) => {
        cells[priceItem.service.slug] = {
          id: priceItem.id,
          status: priceItem.status,
          price: priceItem.price,
          discountPrice: priceItem.discount_price,
          warrantyDays: priceItem.warranty_days,
          note_ar: priceItem.note_ar,
          note_en: priceItem.note_en,
        };
      });

      seriesMap[seriesKey].push({
        id: model.id,
        name: model.name,
        slug: model.slug,
        releaseYear: model.release_year,
        cells,
      });
    });

    const series = Object.entries(seriesMap).map(([title, modelList]) => ({
      title,
      models: modelList,
    }));

    return {
      deviceType: {
        id: deviceType.id,
        name_ar: deviceType.name_ar,
        name_en: deviceType.name_en,
        slug: deviceType.slug,
      },
      columns: services.map((s) => ({
        id: s.id,
        slug: s.slug,
        name_ar: s.name_ar,
        name_en: s.name_en,
        estimatedMinutes: s.estimated_minutes,
      })),
      series,
      updatedAt: new Date().toISOString(),
    };
  }

  async getAdminMatrix(typeSlug = 'iphone') {
    const deviceType = await prisma.deviceType.findUnique({
      where: { slug: typeSlug },
    });

    if (!deviceType) {
      throw new Error('Device type not found');
    }

    const services = await prisma.service.findMany({ orderBy: { order: 'asc' } });
    const models = await prisma.deviceModel.findMany({
      where: { type_id: deviceType.id },
      include: { prices: true },
      orderBy: { order: 'asc' },
    });

    return {
      deviceType,
      services,
      models,
    };
  }

  async bulkUpdateMatrix(
    updates: Array<{
      modelId: string;
      serviceId: string;
      price?: number | null;
      discountPrice?: number | null;
      warrantyDays?: number;
      status: string;
      note_ar?: string | null;
      note_en?: string | null;
    }>,
    user?: { id?: string; email?: string },
    ip?: string
  ) {
    const result = await prisma.$transaction(async (tx) => {
      let modifiedCount = 0;

      for (const item of updates) {
        const existing = await tx.price.findUnique({
          where: {
            model_id_service_id: { model_id: item.modelId, service_id: item.serviceId },
          },
        });

        const updated = await tx.price.upsert({
          where: {
            model_id_service_id: { model_id: item.modelId, service_id: item.serviceId },
          },
          update: {
            price: item.price,
            discount_price: item.discountPrice,
            warranty_days: item.warrantyDays ?? 180,
            status: item.status as PriceStatus,
            note_ar: item.note_ar,
            note_en: item.note_en,
          },
          create: {
            model_id: item.modelId,
            service_id: item.serviceId,
            price: item.price,
            discount_price: item.discountPrice,
            warranty_days: item.warrantyDays ?? 180,
            status: item.status as PriceStatus,
            note_ar: item.note_ar,
            note_en: item.note_en,
          },
        });

        if (existing && existing.price !== item.price) {
          await tx.priceHistory.create({
            data: {
              price_id: updated.id,
              old_price: existing.price,
              new_price: item.price,
              changed_by: user?.email || 'admin',
            },
          });
        }

        modifiedCount++;
      }

      await tx.auditLog.create({
        data: {
          action: 'pricing_bulk_update',
          details: `Updated ${modifiedCount} price entries in matrix`,
          user_id: user?.id,
          ip_address: ip,
        },
      });

      return modifiedCount;
    });

    triggerRevalidation(['prices', 'catalog']).catch(() => {});
    return result;
  }

  async importPrices(rows: any[], dryRun = true) {
    const diff = {
      added: 0,
      updated: 0,
      errors: [] as string[],
      preview: [] as any[],
    };

    for (const row of rows) {
      if (!row.modelSlug || !row.serviceSlug || row.price === undefined) {
        diff.errors.push(`Invalid row structure: ${JSON.stringify(row)}`);
        continue;
      }

      const model = await prisma.deviceModel.findUnique({ where: { slug: row.modelSlug } });
      const service = await prisma.service.findUnique({ where: { slug: row.serviceSlug } });

      if (!model || !service) {
        diff.errors.push(`Model or service not found: ${row.modelSlug} / ${row.serviceSlug}`);
        continue;
      }

      const existing = await prisma.price.findUnique({
        where: { model_id_service_id: { model_id: model.id, service_id: service.id } },
      });

      if (!existing) {
        diff.added++;
        diff.preview.push({ action: 'create', model: model.name, service: service.name_ar, price: row.price });
        if (!dryRun) {
          await prisma.price.create({
            data: {
              model_id: model.id,
              service_id: service.id,
              price: row.price,
              discount_price: row.discountPrice,
              warranty_days: row.warrantyDays || 180,
              status: row.status || 'available',
            },
          });
        }
      } else {
        diff.updated++;
        diff.preview.push({
          action: 'update',
          model: model.name,
          service: service.name_ar,
          oldPrice: existing.price,
          newPrice: row.price,
        });
        if (!dryRun) {
          await prisma.price.update({
            where: { id: existing.id },
            data: {
              price: row.price,
              discount_price: row.discountPrice,
              warranty_days: row.warrantyDays || existing.warranty_days,
              status: row.status || existing.status,
            },
          });
        }
      }
    }

    if (!dryRun) {
      triggerRevalidation(['prices']).catch(() => {});
    }

    return { dryRun, diff };
  }
}

export const pricingService = new PricingService();

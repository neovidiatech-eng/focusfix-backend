import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { requireAuth, AuthenticatedRequest } from '../auth/auth.middleware';
import { logger } from '../../lib/logger';

const router = Router();

// -------------------------------------------------------------------
// PUBLIC: GET /api/v1/pricing?type=iphone
// -------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const typeSlug = (req.query.type as string) || 'iphone';

    const deviceType = await prisma.deviceType.findUnique({
      where: { slug: typeSlug },
    });

    if (!deviceType) {
      return res.status(404).json({ error: 'Device type not found' });
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

    res.json({
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
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing matrix' });
  }
});

// -------------------------------------------------------------------
// ADMIN: GET /api/v1/pricing/admin/matrix
// -------------------------------------------------------------------
router.get('/admin/matrix', requireAuth, async (req: Request, res: Response) => {
  try {
    const typeSlug = (req.query.type as string) || 'iphone';

    const deviceType = await prisma.deviceType.findUnique({
      where: { slug: typeSlug },
    });

    if (!deviceType) return res.status(404).json({ error: 'Device type not found' });

    const services = await prisma.service.findMany({ orderBy: { order: 'asc' } });
    const models = await prisma.deviceModel.findMany({
      where: { type_id: deviceType.id },
      include: { prices: true },
      orderBy: { order: 'asc' },
    });

    res.json({
      deviceType,
      services,
      models,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin matrix' });
  }
});

// -------------------------------------------------------------------
// ADMIN: PUT /api/v1/pricing/admin/matrix (Bulk Update)
// -------------------------------------------------------------------
const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      modelId: z.string().uuid(),
      serviceId: z.string().uuid(),
      price: z.number().nullable().optional(),
      discountPrice: z.number().nullable().optional(),
      warrantyDays: z.number().default(180),
      status: z.enum(['available', 'included', 'on_request', 'unavailable']),
      note_ar: z.string().nullable().optional(),
      note_en: z.string().nullable().optional(),
    })
  ),
});

router.put('/admin/matrix', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = bulkUpdateSchema.parse(req.body);

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
            warranty_days: item.warrantyDays,
            status: item.status,
            note_ar: item.note_ar,
            note_en: item.note_en,
          },
          create: {
            model_id: item.modelId,
            service_id: item.serviceId,
            price: item.price,
            discount_price: item.discountPrice,
            warranty_days: item.warrantyDays,
            status: item.status,
            note_ar: item.note_ar,
            note_en: item.note_en,
          },
        });

        // Record history if price changed
        if (existing && existing.price !== item.price) {
          await tx.priceHistory.create({
            data: {
              price_id: updated.id,
              old_price: existing.price,
              new_price: item.price,
              changed_by: req.user?.email || 'admin',
            },
          });
        }

        modifiedCount++;
      }

      // Log in audit log
      await tx.auditLog.create({
        data: {
          action: 'pricing_bulk_update',
          details: `Updated ${modifiedCount} price entries in matrix`,
          user_id: req.user?.id,
          ip_address: req.ip,
        },
      });

      return modifiedCount;
    });

    // Trigger instant ISR revalidation for prices on public website
    triggerRevalidation(['prices', 'catalog']).catch(() => {});

    res.json({ success: true, count: result });
  } catch (error: any) {
    logger.error({ error }, 'Error in bulk updating prices');
    res.status(400).json({ error: error.message || 'Failed to update prices' });
  }
});

// -------------------------------------------------------------------
// ADMIN: POST /api/v1/pricing/admin/import (Excel Import with Dry Run)
// -------------------------------------------------------------------
router.post('/admin/import', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { rows, dryRun = true } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Rows array is required' });
    }

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

    res.json({ success: true, dryRun, diff });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Import failed' });
  }
});

export default router;

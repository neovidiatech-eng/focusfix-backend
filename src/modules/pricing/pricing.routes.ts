import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/pricing?type=iphone
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

    // Group models by series
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

export default router;

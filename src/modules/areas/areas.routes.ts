import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

// PUBLIC: GET /api/v1/areas
router.get('/', async (req: Request, res: Response) => {
  try {
    const areas = await prisma.area.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
    res.json(areas);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch areas' });
  }
});

// PUBLIC: GET /api/v1/areas/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const area = await prisma.area.findUnique({
      where: { slug: req.params.slug },
      include: { time_slots: { where: { is_active: true } } },
    });

    if (!area) return res.status(404).json({ error: 'Area not found' });
    res.json(area);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch area details' });
  }
});

// ADMIN: POST /api/v1/areas/admin
router.post('/admin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name_ar, name_en, slug, city_ar, transport_fee } = req.body;
    const area = await prisma.area.create({
      data: {
        name_ar,
        name_en,
        slug,
        city_ar: city_ar || 'القاهرة',
        transport_fee: Number(transport_fee || 0),
      },
    });

    triggerRevalidation(['areas']).catch(() => {});
    res.status(201).json(area);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create area' });
  }
});

// ADMIN: PUT /api/v1/areas/admin/:id
router.put('/admin/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name_ar, name_en, transport_fee, is_active } = req.body;
    const area = await prisma.area.update({
      where: { id: req.params.id },
      data: {
        name_ar,
        name_en,
        transport_fee: transport_fee !== undefined ? Number(transport_fee) : undefined,
        is_active,
      },
    });

    triggerRevalidation(['areas', 'prices']).catch(() => {});
    res.json(area);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update area' });
  }
});

// ADMIN: GET /api/v1/areas/admin/:id/slots
router.get('/admin/:id/slots', requireAuth, async (req: Request, res: Response) => {
  try {
    const slots = await prisma.timeSlot.findMany({
      where: { area_id: req.params.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
});

// ADMIN: POST /api/v1/areas/admin/exceptions
router.post('/admin/exceptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { area_id, date, is_closed, max_override, reason } = req.body;
    const exception = await prisma.slotException.create({
      data: {
        area_id,
        date: new Date(date),
        is_closed: !!is_closed,
        max_override: max_override ? Number(max_override) : null,
        reason,
      },
    });
    res.status(201).json(exception);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to create exception' });
  }
});

export default router;

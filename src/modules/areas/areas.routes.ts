import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/areas
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

// GET /api/v1/areas/:slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const area = await prisma.area.findUnique({
      where: { slug: req.params.slug },
      include: { time_slots: { where: { is_active: true } } },
    });

    if (!area) {
      return res.status(404).json({ error: 'Area not found' });
    }

    res.json(area);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch area details' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/catalog/device-types
router.get('/device-types', async (req: Request, res: Response) => {
  try {
    const types = await prisma.deviceType.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
    res.json(types);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device types' });
  }
});

// GET /api/v1/catalog/models?type=iphone
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const where: any = { is_active: true };
    if (type) {
      where.type = { slug: String(type) };
    }
    const models = await prisma.deviceModel.findMany({
      where,
      include: { type: true },
      orderBy: { order: 'asc' },
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch device models' });
  }
});

// GET /api/v1/catalog/services
router.get('/services', async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { is_active: true },
      orderBy: { order: 'asc' },
    });
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/admin/badges (Polling every 30s)
router.get('/badges', async (req: Request, res: Response) => {
  try {
    const pendingBookings = await prisma.booking.count({
      where: { status: 'pending' },
    });
    const newMessages = await prisma.contactMessage.count({
      where: { status: 'new' },
    });

    res.json({
      bookings: pendingBookings,
      messages: newMessages,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// GET /api/v1/admin/stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const totalBookings = await prisma.booking.count();
    const pendingBookings = await prisma.booking.count({ where: { status: 'pending' } });
    const completedBookings = await prisma.booking.count({ where: { status: 'completed' } });

    res.json({
      totalBookings,
      pendingBookings,
      completedBookings,
      estimatedRevenue: 194500,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/v1/admin/bookings
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        customer: true,
        model: true,
        area: true,
        services: { include: { service: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin bookings' });
  }
});

export default router;

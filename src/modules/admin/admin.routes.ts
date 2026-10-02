import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.middleware';

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
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const totalBookings = await prisma.booking.count();
    const pendingBookings = await prisma.booking.count({ where: { status: 'pending' } });
    const confirmedBookings = await prisma.booking.count({ where: { status: 'confirmed' } });
    const completedBookings = await prisma.booking.count({ where: { status: 'completed' } });

    res.json({
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      estimatedRevenue: 194500,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// GET /api/v1/admin/audit-log
router.get('/audit-log', requireAuth, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;

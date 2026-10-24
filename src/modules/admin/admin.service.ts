import { prisma } from '../../lib/prisma';

export class AdminService {
  async getBadges() {
    const pendingBookings = await prisma.booking.count({
      where: { status: 'pending' },
    });
    const newMessages = await prisma.contactMessage.count({
      where: { status: 'new' },
    });

    return {
      bookings: pendingBookings,
      messages: newMessages,
    };
  }

  async getStats() {
    const totalBookings = await prisma.booking.count();
    const pendingBookings = await prisma.booking.count({ where: { status: 'pending' } });
    const confirmedBookings = await prisma.booking.count({ where: { status: 'confirmed' } });
    const completedBookings = await prisma.booking.count({ where: { status: 'completed' } });

    const revenueResult = await prisma.booking.aggregate({
      where: {
        status: { in: ['confirmed', 'completed', 'in_progress', 'assigned', 'on_the_way', 'pending'] },
      },
      _sum: {
        estimated_total: true,
      },
    });

    const estimatedRevenue = Number(revenueResult._sum.estimated_total || 0);

    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      estimatedRevenue,
    };
  }

  async getAuditLogs(take = 100) {
    return prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take,
    });
  }
}

export const adminService = new AdminService();

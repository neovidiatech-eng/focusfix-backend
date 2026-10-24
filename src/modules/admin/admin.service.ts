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

    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      estimatedRevenue: 194500,
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

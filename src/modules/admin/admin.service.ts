import { BookingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type StatsRange = 'today' | '7d' | '30d' | 'year';

const RANGE_DAYS: Record<StatsRange, number> = { today: 1, '7d': 7, '30d': 30, year: 365 };

// Bookings that are accepted but not finished yet
const ACTIVE_STATUSES: BookingStatus[] = ['confirmed', 'assigned', 'on_the_way', 'in_progress'];

/** Today's date (YYYY-MM-DD) in Cairo */
function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
}

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

  async getStats(range: StatsRange = '30d') {
    const days = RANGE_DAYS[range] ?? 30;
    const today = cairoToday();
    const since = new Date(`${today}T00:00:00.000Z`);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    // Cairo midnight is 2–3h before UTC midnight; widen by a day and let the SQL bucket by Cairo date
    const sinceUtc = new Date(since.getTime() - 24 * 60 * 60 * 1000);
    const inRange: Prisma.BookingWhereInput = { created_at: { gte: sinceUtc } };

    const [byStatus, completedRevenue, pipelineRevenue, pendingTotal, todaysAppointments, daily, topServices, topAreas] =
      await Promise.all([
        prisma.booking.groupBy({ by: ['status'], where: inRange, _count: { _all: true } }),
        prisma.booking.findMany({
          where: { ...inRange, status: 'completed' },
          select: { total_final: true, estimated_total: true },
        }),
        prisma.booking.aggregate({
          where: { ...inRange, status: { in: ACTIVE_STATUSES } },
          _sum: { estimated_total: true },
        }),
        prisma.booking.count({ where: { status: 'pending' } }),
        prisma.booking.findMany({
          where: { slot_date: new Date(`${today}T00:00:00.000Z`), status: { notIn: ['cancelled', 'no_show'] } },
          include: { customer: true, model: true, area: true, services: { include: { service: true } } },
          orderBy: { slot_label_snapshot: 'asc' },
        }),
        prisma.$queryRaw<Array<{ day: string; total: bigint; completed: bigint }>>`
          SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS day,
                 COUNT(*) AS total,
                 COUNT(*) FILTER (WHERE status = 'completed') AS completed
          FROM bookings
          WHERE created_at >= ${sinceUtc}
          GROUP BY 1 ORDER BY 1`,
        prisma.bookingService.groupBy({
          by: ['service_id'],
          where: { booking: inRange },
          _count: { _all: true },
          orderBy: { _count: { service_id: 'desc' } },
          take: 5,
        }),
        prisma.booking.groupBy({
          by: ['area_id'],
          where: inRange,
          _count: { _all: true },
          orderBy: { _count: { area_id: 'desc' } },
          take: 5,
        }),
      ]);

    const count = (statuses: BookingStatus[]) =>
      byStatus.filter((s) => statuses.includes(s.status)).reduce((acc, s) => acc + s._count._all, 0);

    // Fill missing days so the chart has a continuous axis
    const dailyMap = new Map(daily.map((d) => [d.day, d]));
    const series: Array<{ date: string; total: number; completed: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      series.push({ date: key, total: Number(row?.total || 0), completed: Number(row?.completed || 0) });
    }

    const [services, areas] = await Promise.all([
      prisma.service.findMany({ where: { id: { in: topServices.map((s) => s.service_id) } } }),
      prisma.area.findMany({ where: { id: { in: topAreas.map((a) => a.area_id) } } }),
    ]);

    const totalBookings = byStatus.reduce((acc, s) => acc + s._count._all, 0);
    const completedBookings = count(['completed']);

    return {
      range,
      totalBookings,
      pendingBookings: pendingTotal,
      confirmedBookings: count(ACTIVE_STATUSES),
      completedBookings,
      cancelledBookings: count(['cancelled', 'no_show']),
      completionRate: totalBookings ? Math.round((completedBookings / totalBookings) * 100) : 0,
      revenue: completedRevenue.reduce((acc, b) => acc + Number(b.total_final ?? b.estimated_total), 0),
      pipelineRevenue: Number(pipelineRevenue._sum.estimated_total || 0),
      // Kept for older dashboard builds
      estimatedRevenue: Number(pipelineRevenue._sum.estimated_total || 0),
      series,
      topServices: topServices.map((s) => ({
        name: services.find((x) => x.id === s.service_id)?.name_ar || '—',
        count: s._count._all,
      })),
      topAreas: topAreas.map((a) => ({
        name: areas.find((x) => x.id === a.area_id)?.name_ar || '—',
        count: a._count._all,
      })),
      todaysAppointments: todaysAppointments.map((b) => ({
        id: b.id,
        bookingNumber: b.booking_number,
        customer: b.customer.name,
        phone: b.customer.phone,
        device: b.model.name,
        services: b.services.map((s) => s.service.name_ar),
        area: b.area.name_ar,
        slot: b.slot_label_snapshot,
        status: b.status,
        total: Number(b.total_final ?? b.estimated_total),
      })),
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

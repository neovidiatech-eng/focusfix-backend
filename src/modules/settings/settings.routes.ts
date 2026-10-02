import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { requireAuth, AuthenticatedRequest } from '../auth/auth.middleware';

const router = Router();

// PUBLIC: GET /api/v1/settings/public
router.get('/public', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {
      phone: '+201009911934',
      whatsapp: '201009911934',
      domain: 'https://focusfix.net',
      supportEmail: 'support@focusfix.net',
      brandName: 'FocusFix',
      working_hours_mode: '12h',
      working_hours_start: '10:00',
      working_hours_end: '18:00',
      slot_capacity: '3',
      banner_enabled: 'true',
      banner_text: 'خصم حصري 15% على صيانة أجهزة آيفون اليوم + فحص فوري وقطع غيار أصلية بضمان عام كامل',
      banner_badge: 'خدمة الطوارئ متوفرة الآن 24/7',
      banner_link: '/book',
      banner_bg_color: 'from-amber-500 via-amber-400 to-amber-500',
    };
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

// ADMIN: GET /api/v1/settings/admin
router.get('/admin', requireAuth, async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ADMIN: PUT /api/v1/settings/admin (Bulk update)
router.put('/admin', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { settings } = req.body; // Array of { key, value }
    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings array required' });
    }

    for (const item of settings) {
      await prisma.setting.upsert({
        where: { key: item.key },
        update: { value: String(item.value) },
        create: { key: item.key, value: String(item.value) },
      });
    }

    triggerRevalidation(['settings']).catch(() => {});
    res.json({ success: true, count: settings.length });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to update settings' });
  }
});

export default router;

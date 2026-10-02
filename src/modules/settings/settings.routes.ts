import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

// GET /api/v1/settings/public
router.get('/public', async (req: Request, res: Response) => {
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {
      phone: '+201009911934',
      whatsapp: '201009911934',
      domain: 'https://focusfix.net',
      supportEmail: 'support@focusfix.net',
      brandName: 'FocusFix',
    };
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public settings' });
  }
});

export default router;

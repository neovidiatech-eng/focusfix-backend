import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  message: z.string().min(5),
  attribution: z.record(z.any()).optional(),
  locale: z.string().default('ar'),
});

const quoteRequestSchema = z.object({
  type: z.enum(['model_request', 'area_request']),
  name: z.string().min(2),
  phone: z.string().min(10),
  details: z.string().optional(),
  attribution: z.record(z.any()).optional(),
});

// PUBLIC: POST /api/v1/contact
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = contactSchema.parse(req.body);
    const msg = await prisma.contactMessage.create({
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        message: data.message,
        attribution: data.attribution || {},
        locale: data.locale,
      },
    });
    res.status(201).json({ success: true, id: msg.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid contact payload' });
  }
});

// PUBLIC: POST /api/v1/contact/quotes
router.post('/quotes', async (req: Request, res: Response) => {
  try {
    const data = quoteRequestSchema.parse(req.body);
    const quote = await prisma.quoteRequest.create({
      data: {
        type: data.type,
        name: data.name,
        phone: data.phone,
        details: data.details,
        attribution: data.attribution || {},
      },
    });
    res.status(201).json({ success: true, id: quote.id });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Invalid quote payload' });
  }
});

// ADMIN: GET /api/v1/contact/admin/messages
router.get('/admin/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch contact messages' });
  }
});

// ADMIN: GET /api/v1/contact/admin/quotes
router.get('/admin/quotes', requireAuth, async (req: Request, res: Response) => {
  try {
    const quotes = await prisma.quoteRequest.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// ADMIN: PATCH /api/v1/contact/admin/messages/:id/status
router.patch('/admin/messages/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const msg = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(msg);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message status' });
  }
});

export default router;

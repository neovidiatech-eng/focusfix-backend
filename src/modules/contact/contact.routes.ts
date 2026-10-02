import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

const router = Router();

const contactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  message: z.string().min(5),
  attribution: z.record(z.any()).optional(),
  locale: z.string().default('ar'),
});

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

export default router;

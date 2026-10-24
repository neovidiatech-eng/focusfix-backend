import { Request, Response } from 'express';
import { z } from 'zod';
import { contactService } from './contact.service';

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

export class ContactController {
  async submitContact(req: Request, res: Response) {
    try {
      const data = contactSchema.parse(req.body);
      const msg = await contactService.createMessage(data);
      res.status(201).json({ success: true, id: msg.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Invalid contact payload' });
    }
  }

  async submitQuote(req: Request, res: Response) {
    try {
      const data = quoteRequestSchema.parse(req.body);
      const quote = await contactService.createQuote(data);
      res.status(201).json({ success: true, id: quote.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Invalid quote payload' });
    }
  }

  async getMessages(req: Request, res: Response) {
    try {
      const messages = await contactService.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contact messages' });
    }
  }

  async getQuotes(req: Request, res: Response) {
    try {
      const quotes = await contactService.getQuotes();
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch quotes' });
    }
  }

  async updateMessageStatus(req: Request, res: Response) {
    try {
      const { status } = req.body;
      const msg = await contactService.updateMessageStatus(req.params.id, status);
      res.json(msg);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update message status' });
    }
  }
}

export const contactController = new ContactController();

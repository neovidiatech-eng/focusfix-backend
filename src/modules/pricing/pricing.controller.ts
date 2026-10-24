import { Request, Response } from 'express';
import { z } from 'zod';
import { pricingService } from './pricing.service';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { logger } from '../../lib/logger';

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      modelId: z.string().uuid(),
      serviceId: z.string().uuid(),
      price: z.number().nullable().optional(),
      discountPrice: z.number().nullable().optional(),
      warrantyDays: z.number().default(180),
      status: z.enum(['available', 'included', 'on_request', 'unavailable']),
      note_ar: z.string().nullable().optional(),
      note_en: z.string().nullable().optional(),
    })
  ),
});

export class PricingController {
  async getPublicMatrix(req: Request, res: Response) {
    try {
      const typeSlug = (req.query.type as string) || 'iphone';
      const result = await pricingService.getPublicMatrix(typeSlug);
      res.json(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: error.message || 'Failed to fetch pricing matrix' });
    }
  }

  async getAdminMatrix(req: Request, res: Response) {
    try {
      const typeSlug = (req.query.type as string) || 'iphone';
      const result = await pricingService.getAdminMatrix(typeSlug);
      res.json(result);
    } catch (error: any) {
      const status = error.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: error.message || 'Failed to fetch admin matrix' });
    }
  }

  async bulkUpdateMatrix(req: AuthenticatedRequest, res: Response) {
    try {
      const { updates } = bulkUpdateSchema.parse(req.body);
      const user = req.user ? { id: req.user.id, email: req.user.email } : undefined;
      const ip = req.ip || req.socket.remoteAddress;

      const count = await pricingService.bulkUpdateMatrix(updates, user, ip);
      res.json({ success: true, count });
    } catch (error: any) {
      logger.error({ error }, 'Error in bulk updating prices');
      res.status(400).json({ error: error.message || 'Failed to update prices' });
    }
  }

  async importPrices(req: AuthenticatedRequest, res: Response) {
    try {
      const { rows, dryRun = true } = req.body;
      if (!Array.isArray(rows)) {
        return res.status(400).json({ error: 'Rows array is required' });
      }

      const result = await pricingService.importPrices(rows, dryRun);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Import failed' });
    }
  }
}

export const pricingController = new PricingController();

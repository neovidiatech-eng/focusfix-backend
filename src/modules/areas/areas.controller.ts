import { sendError } from '../../lib/errors';
import { Request, Response } from 'express';
import { areasService } from './areas.service';

export class AreasController {
  async getAreas(req: Request, res: Response) {
    try {
      const areas = await areasService.getActiveAreas();
      res.json(areas);
    } catch (error) {
      sendError(res, error, 'Failed to fetch areas');
    }
  }

  async getAreaBySlug(req: Request, res: Response) {
    try {
      const area = await areasService.getAreaBySlug(req.params.slug);
      res.json(area);
    } catch (error: any) {
      sendError(res, error, 'Area not found', 404);
    }
  }

  async createArea(req: Request, res: Response) {
    try {
      const area = await areasService.createArea(req.body);
      res.status(201).json(area);
    } catch (error: any) {
      sendError(res, error, 'Failed to create area', 400);
    }
  }

  async updateArea(req: Request, res: Response) {
    try {
      const area = await areasService.updateArea(req.params.id, req.body);
      res.json(area);
    } catch (error: any) {
      sendError(res, error, 'Failed to update area', 400);
    }
  }

  async deleteArea(req: Request, res: Response) {
    try {
      const area = await areasService.deleteArea(req.params.id);
      res.json({ success: true, deleted: area });
    } catch (error: any) {
      sendError(res, error, 'Failed to delete area', 400);
    }
  }

  async getAreaSlots(req: Request, res: Response) {
    try {
      const slots = await areasService.getAreaSlots(req.params.id);
      res.json(slots);
    } catch (error) {
      sendError(res, error, 'Failed to fetch slots');
    }
  }

  async createSlotException(req: Request, res: Response) {
    try {
      const exception = await areasService.createSlotException(req.body);
      res.status(201).json(exception);
    } catch (error: any) {
      sendError(res, error, 'Failed to create exception', 400);
    }
  }

  async getAdminAreas(_req: Request, res: Response) {
    try {
      res.json(await areasService.getAdminAreas());
    } catch (error) {
      sendError(res, error, 'Failed to fetch areas');
    }
  }

  async replaceAreaSlots(req: Request, res: Response) {
    try {
      const slots = Array.isArray(req.body?.slots) ? req.body.slots : null;
      if (!slots) return res.status(400).json({ error: 'slots array is required' });
      res.json(await areasService.replaceAreaSlots(req.params.id, slots));
    } catch (error) {
      sendError(res, error, 'Failed to save slots');
    }
  }

  async getSlotExceptions(req: Request, res: Response) {
    try {
      res.json(await areasService.getSlotExceptions(req.params.id));
    } catch (error) {
      sendError(res, error, 'Failed to fetch exceptions');
    }
  }

  async deleteSlotException(req: Request, res: Response) {
    try {
      await areasService.deleteSlotException(req.params.exceptionId);
      res.json({ success: true });
    } catch (error) {
      sendError(res, error, 'Failed to delete exception');
    }
  }
}

export const areasController = new AreasController();

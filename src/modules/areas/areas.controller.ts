import { Request, Response } from 'express';
import { areasService } from './areas.service';

export class AreasController {
  async getAreas(req: Request, res: Response) {
    try {
      const areas = await areasService.getActiveAreas();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch areas' });
    }
  }

  async getAreaBySlug(req: Request, res: Response) {
    try {
      const area = await areasService.getAreaBySlug(req.params.slug);
      res.json(area);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Area not found' });
    }
  }

  async createArea(req: Request, res: Response) {
    try {
      const area = await areasService.createArea(req.body);
      res.status(201).json(area);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create area' });
    }
  }

  async updateArea(req: Request, res: Response) {
    try {
      const area = await areasService.updateArea(req.params.id, req.body);
      res.json(area);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update area' });
    }
  }

  async deleteArea(req: Request, res: Response) {
    try {
      const area = await areasService.deleteArea(req.params.id);
      res.json({ success: true, deleted: area });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete area' });
    }
  }

  async getAreaSlots(req: Request, res: Response) {
    try {
      const slots = await areasService.getAreaSlots(req.params.id);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch slots' });
    }
  }

  async createSlotException(req: Request, res: Response) {
    try {
      const exception = await areasService.createSlotException(req.body);
      res.status(201).json(exception);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create exception' });
    }
  }
}

export const areasController = new AreasController();

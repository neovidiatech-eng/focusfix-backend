import { Request, Response } from 'express';
import { catalogService } from './catalog.service';

export class CatalogController {
  async getDeviceTypes(req: Request, res: Response) {
    try {
      const types = await catalogService.getDeviceTypes();
      res.json(types);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch device types' });
    }
  }

  async getModels(req: Request, res: Response) {
    try {
      const { type } = req.query;
      const models = await catalogService.getDeviceModels(type ? String(type) : undefined);
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch device models' });
    }
  }

  async getServices(req: Request, res: Response) {
    try {
      const services = await catalogService.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  }
}

export const catalogController = new CatalogController();

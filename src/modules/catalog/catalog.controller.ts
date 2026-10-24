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

  async createModel(req: Request, res: Response) {
    try {
      const model = await catalogService.createModel(req.body);
      res.status(201).json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create model' });
    }
  }

  async updateModel(req: Request, res: Response) {
    try {
      const model = await catalogService.updateModel(req.params.id, req.body);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update model' });
    }
  }

  async deleteModel(req: Request, res: Response) {
    try {
      await catalogService.deleteModel(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete model' });
    }
  }

  async createService(req: Request, res: Response) {
    try {
      const service = await catalogService.createService(req.body);
      res.status(201).json(service);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to create service' });
    }
  }

  async deleteService(req: Request, res: Response) {
    try {
      await catalogService.deleteService(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to delete service' });
    }
  }
}

export const catalogController = new CatalogController();

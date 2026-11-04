import { sendError } from '../../lib/errors';
import { Request, Response } from 'express';
import { catalogService } from './catalog.service';

export class CatalogController {
  async getDeviceTypes(req: Request, res: Response) {
    try {
      const types = await catalogService.getDeviceTypes();
      res.json(types);
    } catch (error) {
      sendError(res, error, 'Failed to fetch device types');
    }
  }

  async getModels(req: Request, res: Response) {
    try {
      const { type } = req.query;
      const models = await catalogService.getDeviceModels(type ? String(type) : undefined);
      res.json(models);
    } catch (error) {
      sendError(res, error, 'Failed to fetch device models');
    }
  }

  async getServices(req: Request, res: Response) {
    try {
      const services = await catalogService.getServices();
      res.json(services);
    } catch (error) {
      sendError(res, error, 'Failed to fetch services');
    }
  }

  async createModel(req: Request, res: Response) {
    try {
      const model = await catalogService.createModel(req.body);
      res.status(201).json(model);
    } catch (error: any) {
      sendError(res, error, 'Failed to create model', 400);
    }
  }

  async updateModel(req: Request, res: Response) {
    try {
      const model = await catalogService.updateModel(req.params.id, req.body);
      res.json(model);
    } catch (error: any) {
      sendError(res, error, 'Failed to update model', 400);
    }
  }

  async deleteModel(req: Request, res: Response) {
    try {
      const result = await catalogService.deleteModel(req.params.id);
      res.json({ success: true, id: req.params.id, ...result });
    } catch (error: any) {
      sendError(res, error, 'Failed to delete model', 400);
    }
  }

  async createService(req: Request, res: Response) {
    try {
      const service = await catalogService.createService(req.body);
      res.status(201).json(service);
    } catch (error: any) {
      sendError(res, error, 'Failed to create service', 400);
    }
  }

  async deleteService(req: Request, res: Response) {
    try {
      const result = await catalogService.deleteService(req.params.id);
      res.json({ success: true, id: req.params.id, ...result });
    } catch (error: any) {
      sendError(res, error, 'Failed to delete service', 400);
    }
  }

  async getAdminCatalog(_req: Request, res: Response) {
    try {
      res.json(await catalogService.getAdminCatalog());
    } catch (error) {
      sendError(res, error, 'Failed to fetch catalog');
    }
  }

  async updateService(req: Request, res: Response) {
    try {
      res.json(await catalogService.updateService(req.params.id, req.body));
    } catch (error) {
      sendError(res, error, 'Failed to update service');
    }
  }

  async updateDeviceType(req: Request, res: Response) {
    try {
      res.json(await catalogService.updateDeviceType(req.params.id, req.body));
    } catch (error) {
      sendError(res, error, 'Failed to update device type');
    }
  }
}

export const catalogController = new CatalogController();

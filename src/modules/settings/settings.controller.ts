import { sendError } from '../../lib/errors';
import { Request, Response } from 'express';
import { settingsService } from './settings.service';

export class SettingsController {
  async getPublicSettings(req: Request, res: Response) {
    try {
      const settingsMap = await settingsService.getPublicSettings();
      res.json(settingsMap);
    } catch (error) {
      sendError(res, error, 'Failed to fetch public settings');
    }
  }

  async getAdminSettings(req: Request, res: Response) {
    try {
      const settings = await settingsService.getAllSettings();
      res.json(settings);
    } catch (error) {
      sendError(res, error, 'Failed to fetch settings');
    }
  }

  async updateAdminSettings(req: Request, res: Response) {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) {
        return res.status(400).json({ error: 'Settings array required' });
      }

      const result = await settingsService.bulkUpdateSettings(settings);
      res.json(result);
    } catch (error: any) {
      sendError(res, error, 'Failed to update settings', 400);
    }
  }

  async getCodes(req: Request, res: Response) {
    try {
      res.json(await settingsService.getCodes());
    } catch (error) {
      sendError(res, error, 'Failed to load tracking codes');
    }
  }

  async updateCodes(req: Request, res: Response) {
    try {
      res.json(await settingsService.updateCodes(req.body || {}, (req as any).user, req.ip));
    } catch (error) {
      sendError(res, error, 'Failed to save tracking codes');
    }
  }
}

export const settingsController = new SettingsController();

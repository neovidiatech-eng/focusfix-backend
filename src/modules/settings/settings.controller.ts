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
}

export const settingsController = new SettingsController();

import { sendError } from '../../lib/errors';
import { Request, Response } from 'express';
import { adminService, StatsRange } from './admin.service';

export class AdminController {
  async getBadges(req: Request, res: Response) {
    try {
      const badges = await adminService.getBadges();
      res.json(badges);
    } catch (error) {
      sendError(res, error, 'Failed to fetch badges');
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const range = ['today', '7d', '30d', 'year'].includes(String(req.query.range)) ? (String(req.query.range) as StatsRange) : '30d';
      const stats = await adminService.getStats(range);
      res.json(stats);
    } catch (error) {
      sendError(res, error, 'Failed to fetch admin stats');
    }
  }

  async getAuditLog(req: Request, res: Response) {
    try {
      const logs = await adminService.getAuditLogs(Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500));
      res.json(logs);
    } catch (error) {
      sendError(res, error, 'Failed to fetch audit log');
    }
  }
}

export const adminController = new AdminController();

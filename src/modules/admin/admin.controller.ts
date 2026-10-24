import { Request, Response } from 'express';
import { adminService } from './admin.service';

export class AdminController {
  async getBadges(req: Request, res: Response) {
    try {
      const badges = await adminService.getBadges();
      res.json(badges);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch badges' });
    }
  }

  async getStats(req: Request, res: Response) {
    try {
      const stats = await adminService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admin stats' });
    }
  }

  async getAuditLog(req: Request, res: Response) {
    try {
      const logs = await adminService.getAuditLogs();
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit log' });
    }
  }
}

export const adminController = new AdminController();

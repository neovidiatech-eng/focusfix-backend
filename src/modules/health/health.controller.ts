import { Request, Response } from 'express';
import { healthService } from './health.service';

export class HealthController {
  getHealth(req: Request, res: Response) {
    const status = healthService.getHealthStatus();
    res.json(status);
  }
}

export const healthController = new HealthController();

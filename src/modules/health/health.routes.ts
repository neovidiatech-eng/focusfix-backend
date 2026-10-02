import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'focusfix-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

export default router;

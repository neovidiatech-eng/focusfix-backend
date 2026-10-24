import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { AuthenticatedRequest } from './auth.middleware';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress;

      const result = await authService.login(email, password, ip);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        accessToken: result.accessToken,
        token: result.accessToken,
        user: result.user,
      });
    } catch (error: any) {
      const status = error.message.includes('البريد الإلكتروني') ? 401 : 400;
      res.status(status).json({ error: error.message || 'بيانات الدخول غير صالحة' });
    }
  }

  refresh(req: Request, res: Response) {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    try {
      const result = authService.refresh(token);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  }

  logout(req: Request, res: Response) {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  }

  async getMe(req: AuthenticatedRequest, res: Response) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const user = await authService.getMe(req.user.id);
      res.json(user);
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'User not found' });
    }
  }
}

export const authController = new AuthController();

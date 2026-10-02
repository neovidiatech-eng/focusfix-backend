import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import {
  requireAuth,
  AuthenticatedRequest,
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
} from './auth.middleware';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// POST /api/v1/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    // Sign Access Token (15 minutes) & Refresh Token (30 days)
    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    // Set secure HttpOnly cookie for refreshToken
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    // Log login in audit_log
    await prisma.auditLog.create({
      data: {
        action: 'auth_login',
        details: `User ${user.email} logged in successfully`,
        user_id: user.id,
        ip_address: req.ip || req.socket.remoteAddress,
      },
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'بيانات الدخول غير صالحة' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
    const payload = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    const newAccessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true, is_active: true },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;

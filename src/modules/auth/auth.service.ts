import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { JWT_ACCESS_SECRET, JWT_REFRESH_SECRET } from './auth.middleware';

export class AuthService {
  async login(email: string, password: string, ip?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    // Log login in audit_log
    await prisma.auditLog.create({
      data: {
        action: 'auth_login',
        details: `User ${user.email} logged in successfully`,
        user_id: user.id,
        ip_address: ip,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  refresh(token: string) {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as any;
    const payload = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
    const accessToken = jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: '15m' });
    return { accessToken };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, is_active: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}

export const authService = new AuthService();

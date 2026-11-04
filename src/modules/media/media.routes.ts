import { Router, Request, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../auth/auth.middleware';
import { HttpError, sendError } from '../../lib/errors';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
});

/** Public base for uploaded files, e.g. https://api.focusfix.net */
function publicBase(req: Request) {
  return (process.env.API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/(api\/v1)?\/?$/, '');
}

const router = Router();

// POST /api/v1/media/admin/upload  (multipart field "file")
// Re-encodes every image to WebP (max 1600px) — strips metadata and blocks disguised files
router.post('/admin/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) throw new HttpError(400, 'ارفع صورة JPG أو PNG أو WebP (أقصى حجم 8MB)');
    const { data, info } = await sharp(req.file.buffer, { animated: false })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
      .catch(() => {
        throw new HttpError(400, 'الملف ده مش صورة صالحة');
      });

    const month = new Date().toISOString().slice(0, 7);
    const name = `${randomUUID()}.webp`;
    await fs.mkdir(path.join(UPLOAD_DIR, month), { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, month, name), data);

    const url = `${publicBase(req)}/uploads/${month}/${name}`;
    const media = await prisma.media.create({
      data: {
        url,
        alt_ar: typeof req.body?.alt === 'string' ? req.body.alt.slice(0, 200) : null,
        width: info.width,
        height: info.height,
        mime: 'image/webp',
        size: data.length,
        created_by: (req as any).user?.id || null,
      },
    });
    res.status(201).json({ id: media.id, url, width: info.width, height: info.height });
  } catch (error) {
    sendError(res, error, 'Failed to upload image');
  }
});

export default router;

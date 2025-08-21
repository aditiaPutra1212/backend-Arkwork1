// src/routes/admin.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

const router = Router();

// ---- ENV ----
const JWT_SECRET = process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET || 'dev-admin-secret';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'none' | 'strict';
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && COOKIE_SAMESITE === 'none');

function signAdminToken(payload: { uid: string; role: 'admin' }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}
function setAuthCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    serialize('token', token, {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
  );
}

// ---- Zod schema ----
const adminSigninSchema = z.object({
  usernameOrEmail: z.string().min(3),
  password: z.string().min(6),
});

// POST /admin/signin   (BARU: username ATAU email)
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const parsed = adminSigninSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.format() });
    }
    const { usernameOrEmail, password } = parsed.data;

    // tentukan username target
    const emailsEnv = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    const hasAt = usernameOrEmail.includes('@');
    const lower = usernameOrEmail.toLowerCase();

    let usernameToFind: string | null = null;

    if (hasAt) {
      // cocokkan email → username dari env (kalau ada)
      if (
        emailsEnv.length > 0 &&
        emailsEnv.includes(lower) &&
        process.env.ADMIN_USERNAME
      ) {
        usernameToFind = process.env.ADMIN_USERNAME;
      } else {
        // fallback: pakai local-part sebelum @
        usernameToFind = usernameOrEmail.split('@')[0];
      }
    } else {
      usernameToFind = usernameOrEmail;
    }

    const admin = await prisma.admin.findUnique({
      where: { username: usernameToFind },
    });

    if (!admin) {
      return res.status(401).json({ message: 'Email/Username atau password salah' });
    }

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Email/Username atau password salah' });
    }

    const token = signAdminToken({ uid: admin.id, role: 'admin' });
    setAuthCookie(res, token);

    return res.json({
      ok: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (e) {
    console.error('ADMIN SIGNIN ERROR:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// (opsional) /admin/me untuk restore sesi
router.get('/me', async (req, res) => {
  try {
    const raw = req.headers.cookie || '';
    const token = raw.split(';').map(s => s.trim()).find(s => s.startsWith('token='))?.split('=')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const payload = jwt.verify(token, JWT_SECRET) as { uid: string; role: 'admin' };
    const admin = await prisma.admin.findUnique({
      where: { id: payload.uid },
      select: { id: true, username: true },
    });
    if (!admin) return res.status(401).json({ message: 'Unauthorized' });

    return res.json({ id: admin.id, username: admin.username, role: 'admin' });
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;

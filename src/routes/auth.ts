// src/routes/auth.ts
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const router = Router();

/** ================== ENV ================== **/
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'none' | 'strict';
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && COOKIE_SAMESITE === 'none');

/** ================= JWT helpers ================= **/
type JWTPayload = {
  uid: string;               // id user/admin
  role: 'user' | 'admin';    // tipe subjek token
};

function signToken(p: JWTPayload) {
  return jwt.sign(p, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(t: string) {
  return jwt.verify(t, JWT_SECRET) as JWTPayload;
}
function setAuthCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    serialize('token', token, {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    }),
  );
}

/** ================= Validators ================= **/
const userSignupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});

const userSigninSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const adminSigninSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
});

/** ================= Routes ================= **/

// GET /auth
router.get('/', (_req, res) => {
  res.json({ message: 'Auth route works!' });
});

/** ---------------- USER: SIGNUP ---------------- */
// POST /auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const parsed = userSignupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
    const { name, email, password } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ message: 'Email already used' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, photoUrl: true, cvUrl: true, createdAt: true },
    });

    const token = signToken({ uid: user.id, role: 'user' });
    setAuthCookie(res, token);

    return res.status(201).json(user);
  } catch (e) {
    console.error('USER SIGNUP ERROR:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/** ---------------- USER: SIGNIN ---------------- */
// POST /auth/signin
router.post('/signin', async (req: Request, res: Response) => {
  try {
    const parsed = userSigninSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ message: 'Email atau password salah' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Email atau password salah' });

    const token = signToken({ uid: user.id, role: 'user' });
    setAuthCookie(res, token);

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      photoUrl: user.photoUrl ?? null,
      cvUrl: user.cvUrl ?? null,
      role: 'user',
    });
  } catch (e) {
    console.error('USER SIGNIN ERROR:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/** ---------------- USER: SIGNOUT ---------------- */
// POST /auth/signout
router.post('/signout', (_req: Request, res: Response) => {
  res.setHeader(
    'Set-Cookie',
    serialize('token', '', {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: 0,
    }),
  );
  return res.status(204).end();
});

/** ---------------- USER/ADMIN: ME ---------------- */
// GET /auth/me
router.get('/me', async (req: Request, res: Response) => {
  try {
    const raw = req.headers.cookie || '';
    const cookies = parse(raw);
    const token = cookies['token'];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const payload = verifyToken(token); // { uid, role }

    if (payload.role === 'user') {
      const u = await prisma.user.findUnique({
        where: { id: payload.uid },
        select: { id: true, email: true, name: true, photoUrl: true, cvUrl: true, createdAt: true },
      });
      if (!u) return res.status(401).json({ message: 'Unauthorized' });
      return res.json({ ...u, role: 'user' });
    }

    // role === 'admin'
    const a = await prisma.admin.findUnique({
      where: { id: payload.uid },
      select: { id: true, username: true, createdAt: true },
    });
    if (!a) return res.status(401).json({ message: 'Unauthorized' });
    return res.json({ id: a.id, email: `${a.username}@local`, name: a.username, role: 'admin' });
  } catch (e) {
    console.error('ME ERROR:', e);
    return res.status(401).json({ message: 'Invalid token' });
  }
});

/** ---------------- ADMIN: SIGNIN ---------------- */
// POST /admin/signin
router.post('/admin/signin', async (req: Request, res: Response) => {
  try {
    const parsed = adminSigninSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

    const { username, password } = parsed.data;

    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) return res.status(401).json({ message: 'Username atau password salah' });

    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Username atau password salah' });

    const token = signToken({ uid: admin.id, role: 'admin' });
    setAuthCookie(res, token);

    return res.json({ id: admin.id, email: `${admin.username}@local`, name: admin.username, role: 'admin' });
  } catch (e) {
    console.error('ADMIN SIGNIN ERROR:', e);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/** ---------------- ADMIN: SIGNOUT (opsional) ---------------- */
router.post('/admin/signout', (_req: Request, res: Response) => {
  res.setHeader(
    'Set-Cookie',
    serialize('token', '', {
      httpOnly: true,
      sameSite: COOKIE_SAMESITE,
      secure: COOKIE_SECURE,
      path: '/',
      maxAge: 0,
    }),
  );
  return res.status(204).end();
});

export default router;

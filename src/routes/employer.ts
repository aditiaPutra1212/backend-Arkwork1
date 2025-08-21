// src/routes/employer.ts
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import {
  Step1Schema, Step2Schema, Step3Schema, Step4Schema, Step5Schema
} from '../validators/employer';
import {
  checkAvailability,
  createAccount,
  upsertProfile,
  choosePlan,
  createDraftJob,
  submitVerification,
} from '../services/employer';
import { prisma } from '../lib/prisma';

export const employerRouter = Router();

/* ================== AUTH HELPERS (selaras dgn routes/auth.ts) ================== */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

type JWTPayload = {
  uid: string;                  // user id
  role: 'admin' | 'user';
  eid?: string | null;          // employerId aktif (opsional)
};

function getAuth(req: Request): { userId: string; employerId?: string | null } | null {
  const raw = req.headers.cookie || '';
  const cookies = parseCookie(raw);
  const token = cookies['token'];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return { userId: payload.uid, employerId: payload.eid ?? null };
  } catch {
    return null;
  }
}

/* ================== ALUR 5 STEP SIGNUP EMPLOYER ================== */

// GET /api/employers/availability?slug=...&email=...
employerRouter.get('/availability', async (req, res, next) => {
  try {
    const data = await checkAvailability({
      slug: (req.query.slug as string) || '',
      email: (req.query.email as string) || '',
    });
    res.json(data);
  } catch (e) { next(e); }
});

// POST /api/employers/step1
// membuat akun employer + (opsional) user owner (bergantung implementasi kamu di services)
employerRouter.post('/step1', async (req, res, next) => {
  try {
    const parsed = Step1Schema.parse(req.body);
    const result = await createAccount(parsed);
    // TIDAK auto-login → user akan sign-in di akhir onboarding
    res.json({
      ok: true,
      ...result,             // { employerId, employerSlug, userId? }
      next: '/api/employers/step2',
    });
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Email already used' });
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    next(e);
  }
});

// POST /api/employers/step2 (lengkapi profil perusahaan)
employerRouter.post('/step2', async (req, res, next) => {
  try {
    const parsed = Step2Schema.parse(req.body);
    const { employerId, ...profile } = parsed;
    const data = await upsertProfile(employerId, profile);
    res.json({ ok: true, data, next: '/api/employers/step3' });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    next(e);
  }
});

// POST /api/employers/step3 (pilih paket)
employerRouter.post('/step3', async (req, res, next) => {
  try {
    const parsed = Step3Schema.parse(req.body);
    const data = await choosePlan(parsed.employerId, parsed.planSlug);
    res.json({ ok: true, data, next: '/api/employers/step4' });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    next(e);
  }
});

// POST /api/employers/step4 (buat draft job)
employerRouter.post('/step4', async (req, res, next) => {
  try {
    const parsed = Step4Schema.parse(req.body);
    const { employerId, ...rest } = parsed;
    const data = await createDraftJob(employerId, rest);
    res.json({ ok: true, data, next: '/api/employers/step5' });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    next(e);
  }
});

// POST /api/employers/step5 (submit verifikasi)
// Setelah verifikasi tersubmit, arahkan FE untuk menampilkan CTA "Sign in"
employerRouter.post('/step5', async (req, res, next) => {
  try {
    const parsed = Step5Schema.parse(req.body);
    const data = await submitVerification(parsed.employerId, parsed.note, parsed.files);

    // Ambil slug utk query di /auth/signin (opsional)
    let slug: string | null = null;
    try {
      const emp = await prisma.employer.findUnique({
        where: { id: parsed.employerId },
        select: { slug: true },
      });
      slug = emp?.slug ?? null;
    } catch {
      slug = null;
    }

    res.json({
      ok: true,
      data,
      onboarding: 'completed',
      message: 'Verifikasi terkirim. Silakan sign in untuk melanjutkan.',
      signinRedirect: slug ? `/auth/signin?employerSlug=${encodeURIComponent(slug)}` : `/auth/signin`,
    });
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ error: 'Validation error', details: e.issues });
    next(e);
  }
});

/* ================== ENDPOINT SESI EMPLOYER (untuk Nav/FE) ================== */
// GET /api/employers/me
// Membaca cookie JWT (dibuat oleh /auth/signin) dan mengembalikan employer aktif
employerRouter.get('/me', async (req: Request, res: Response) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  let employer:
    | { id: string; slug: string; displayName: string | null; legalName: string | null }
    | null = null;

  // jika ada employerId di token (eid), pakai itu
  if (auth.employerId) {
    employer = await prisma.employer.findUnique({
      where: { id: auth.employerId },
      select: { id: true, slug: true, displayName: true, legalName: true },
    });
  }

  // fallback tanpa ownerId: ambil employer pertama (urut terbaru)
  if (!employer) {
    employer = await prisma.employer.findFirst({
      select: { id: true, slug: true, displayName: true, legalName: true },
      // kalau schema tidak punya createdAt, hapus baris di bawah ini
      orderBy: { createdAt: 'desc' },
    });
  }

  return res.json({ employer });
});

/* ================== (OPSIONAL) RINGKASAN / LISTING ==================
   Endpoint berikut cocok dengan FE contoh. Silakan ganti query-nya
   ke prisma model kamu yang sebenarnya atau hapus bila tak dibutuhkan.
===================================================================== */

// GET /api/employers/stats
employerRouter.get('/stats', async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  // contoh dummy; ganti dengan query real
  res.json({
    activeJobs: 0,
    totalApplicants: 0,
    interviews: 0,
    views: 0,
    lastUpdated: new Date().toISOString(),
  });
});

// GET /api/employers/jobs
employerRouter.get('/jobs', async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  // contoh dummy; ganti dengan query real dari prisma.job
  res.json([]);
});

// GET /api/employers/applications
employerRouter.get('/applications', async (req, res) => {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: 'Unauthorized' });

  // contoh dummy; ganti dengan query real dari prisma.application
  res.json([]);
});

export default employerRouter;

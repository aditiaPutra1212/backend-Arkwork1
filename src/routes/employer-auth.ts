import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { serialize, parse as parseCookie } from 'cookie'

const router = Router()

// ===== ENV & helpers
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || 'lax') as 'lax'|'none'|'strict'
const COOKIE_SECURE =
  process.env.COOKIE_SECURE === 'true' ||
  (process.env.NODE_ENV === 'production' && COOKIE_SAMESITE === 'none')

type JWTPayload = { uid: string; role: 'employer'; eid: string }
const sign = (p: JWTPayload) => jwt.sign(p, JWT_SECRET, { expiresIn: '7d' })
const setEmpCookie = (res: Response, token: string) => {
  res.setHeader('Set-Cookie', serialize('emp_token', token, {
    httpOnly: true, sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE,
    path: '/', maxAge: 60*60*24*7
  }))
}
const readEmpCookie = (req: Request) => {
  const token = parseCookie(req.headers.cookie || '')['emp_token']
  if (!token) return null
  try { return jwt.verify(token, JWT_SECRET) as JWTPayload } catch { return null }
}

// ===== Schemas
const signinSchema = z.object({ email: z.string().email(), password: z.string().min(8) })
const signupSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  website: z.string().url().optional()
})

// ===== Routes
// POST /employer/auth/signup  -> buat Employer + EmployerAdminUser + set emp_token
router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() })
  const { companyName, email, password, website } = parsed.data

  const exist = await prisma.employerAdminUser.findUnique({ where: { email } })
  if (exist) return res.status(409).json({ message: 'Email sudah terpakai' })

  const employer = await prisma.employer.create({
    data: {
      slug: companyName.toLowerCase().replace(/\s+/g,'-'),
      displayName: companyName, legalName: companyName, website: website ?? null
    },
    select: { id: true, slug: true, displayName: true }
  })

  const passwordHash = await bcrypt.hash(password, 10)
  const admin = await prisma.employerAdminUser.create({
    data: {
      employerId: employer.id, email, passwordHash,
      fullName: companyName, isOwner: true, agreedTosAt: new Date()
    },
    select: { id: true, email: true, fullName: true }
  })

  const token = sign({ uid: admin.id, role: 'employer', eid: employer.id })
  setEmpCookie(res, token)

  res.status(201).json({ ok: true, admin, employer })
})

// POST /employer/auth/signin  -> login employer-admin
router.post('/signin', async (req, res) => {
  const parsed = signinSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() })
  const { email, password } = parsed.data

  const admin = await prisma.employerAdminUser.findUnique({ where: { email } })
  if (!admin) return res.status(401).json({ message: 'Email atau password salah' })

  const ok = await bcrypt.compare(password, admin.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Email atau password salah' })

  const employer = await prisma.employer.findUnique({
    where: { id: admin.employerId },
    select: { id: true, slug: true, displayName: true, legalName: true }
  })
  if (!employer) return res.status(404).json({ message: 'Employer tidak ditemukan' })

  const token = sign({ uid: admin.id, role: 'employer', eid: employer.id })
  setEmpCookie(res, token)

  res.json({
    ok: true,
    admin: { id: admin.id, email: admin.email, fullName: admin.fullName, isOwner: !!admin.isOwner },
    employer
  })
})

// POST /employer/auth/signout
router.post('/signout', (_req, res) => {
  res.setHeader('Set-Cookie', serialize('emp_token','', {
    httpOnly: true, sameSite: COOKIE_SAMESITE, secure: COOKIE_SECURE, path: '/', maxAge: 0
  }))
  res.status(204).end()
})

// GET /employer/auth/me
router.get('/me', async (req, res) => {
  const p = readEmpCookie(req)
  if (!p) return res.status(401).json({ message: 'Unauthorized' })
  const admin = await prisma.employerAdminUser.findUnique({
    where: { id: p.uid },
    select: { id:true, email:true, fullName:true, employerId:true, isOwner:true }
  })
  if (!admin) return res.status(401).json({ message: 'Unauthorized' })
  const employer = await prisma.employer.findUnique({
    where: { id: p.eid }, select: { id:true, slug:true, displayName:true, legalName:true }
  })
  res.json({ ok: true, admin, employer, role: 'employer' })
})

export default router

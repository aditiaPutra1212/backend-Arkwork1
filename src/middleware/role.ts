// backend/src/middleware/role.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export type Role = 'admin' | 'employer' | 'user';
export type AuthPayload = { uid: string; role: Role; eid?: string | null };

// baca token dari cookie dan validasi
export function readAuth(req: Request): AuthPayload {
  const token = parse(req.headers.cookie || '')['token'];
  if (!token) throw new Error('no token');
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    (req as any).auth = readAuth(req);
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const p = readAuth(req);
    (req as any).auth = p;
    if (p.role === 'admin') return next();
    return res.status(403).json({ message: 'Admin only' });
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export function employerRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const p = readAuth(req);
    (req as any).auth = p;
    if (p.role === 'admin' || p.role === 'employer') return next();
    return res.status(403).json({ message: 'Employer only' });
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

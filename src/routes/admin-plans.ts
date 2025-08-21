import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

/** TODO: ganti dengan middleware admin milikmu */
function requireAdmin(_req: Request, _res: Response, next: NextFunction) {
  next();
}

const r = Router();

/* ================= Helpers ================= */
// kirim amount ke FE sebagai number (JSON tak support BigInt)
function serializePlan(p: any) { return { ...p, amount: Number(p.amount) }; }
function serializePlans(items: any[]) { return items.map(serializePlan); }
function toBigIntAmount(v: unknown): bigint {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error('amount must be a non-negative number');
  return BigInt(Math.trunc(n));
}

/* ================= GET list ================= */
r.get('/', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();

    const where: Prisma.PlanWhereInput | undefined = q
      ? { OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ] }
      : undefined;

    const items = await prisma.plan.findMany({ where, orderBy: { id: 'desc' } });
    res.json(serializePlans(items));
  } catch (e) { next(e); }
});

/* ================= GET detail ================= */
r.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const plan = await prisma.plan.findUnique({ where: { id: req.params.id } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    res.json(serializePlan(plan));
  } catch (e) { next(e); }
});

/* ================= CREATE ================= */
r.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { slug, name, description, amount, currency = 'IDR', interval = 'month', active = true, priceId, paymentLinkUrl } = req.body || {};
    if (!slug || !name) return res.status(400).json({ error: 'slug and name are required' });

    let amountBig: bigint;
    try { amountBig = toBigIntAmount(amount); }
    catch (err: any) { return res.status(400).json({ error: err?.message || 'Invalid amount' }); }

    const plan = await prisma.plan.create({
      data: {
        slug: String(slug),
        name: String(name),
        description: description ?? null,
        amount: amountBig as any, // kolom BigInt
        currency: String(currency),
        interval: String(interval),
        active: !!active,
        priceId: priceId ?? null,
        // jika kamu punya kolom paymentLinkUrl di schema, set di sini:
        ...(paymentLinkUrl ? { paymentLinkUrl: String(paymentLinkUrl) } : {}),
      } as any,
    });

    res.status(201).json(serializePlan(plan));
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Slug already exists' });
    next(e);
  }
});

/* ================= UPDATE ================= */
r.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { slug, name, description, amount, currency, interval, active, priceId, paymentLinkUrl } = req.body || {};

    const data: Prisma.PlanUpdateInput = {};
    if (slug !== undefined) data.slug = String(slug);
    if (name !== undefined) data.name = String(name);
    if (description !== undefined) data.description = description ?? null;

    if (amount !== undefined) {
      try { (data as any).amount = toBigIntAmount(amount); }
      catch (err: any) { return res.status(400).json({ error: err?.message || 'Invalid amount' }); }
    }

    if (currency !== undefined) data.currency = String(currency);
    if (interval !== undefined) data.interval = String(interval);
    if (active !== undefined) data.active = !!active;
    if (priceId !== undefined) (data as any).priceId = priceId ?? null;
    if (paymentLinkUrl !== undefined) (data as any).paymentLinkUrl = paymentLinkUrl ?? null;

    const plan = await prisma.plan.update({ where: { id }, data });
    res.json(serializePlan(plan));
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Slug already exists' });
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Plan not found' });
    next(e);
  }
});

/* ================= DELETE ================= */
r.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (e: any) {
    if (e?.code === 'P2025') return res.status(404).json({ error: 'Plan not found' });
    if (e?.code === 'P2003') {
      return res.status(409).json({
        error: 'Plan is referenced by other records (payments/subscriptions). Deactivate it instead of deleting.',
      });
    }
    next(e);
  }
});

export default r;

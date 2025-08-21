// src/routes/payments.ts
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { createSnapForPlan, handleMidtransNotification } from '../services/midtrans';

// ===== Auth placeholder (sesuaikan dengan sistemmu) =====
function requireAuth(req: any, _res: Response, next: NextFunction) {
  // contoh: req.user = { id: 'user-123', employerId: 'emp-456' }
  return next();
}
function getMaybeUserId(req: Request): string | undefined {
  const anyReq = req as any;
  return anyReq?.user?.id ?? anyReq?.session?.user?.id ?? req.body?.userId;
}

const r = Router();

/* ================= LIST (admin/inbox) ================= */
r.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const take = Math.min(Math.max(Number(req.query.take ?? 20), 1), 100);
    const cursor = (req.query.cursor as string | undefined) ?? undefined;
    const status = (req.query.status as string | undefined)?.trim();

    const where = status ? { status } : undefined;

    const items = await prisma.payment.findMany({
      where,
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderId: true,
        status: true,
        method: true,
        grossAmount: true,
        currency: true,
        createdAt: true,
        transactionId: true,
        redirectUrl: true,
        token: true,
        plan: { select: { id: true, slug: true, name: true, interval: true } },
        employer: { select: { id: true, displayName: true, legalName: true, slug: true } },
      },
    });

    const nextCursor = items.length === take ? items[items.length - 1].id : null;
    res.json({ items, nextCursor });
  } catch (e) {
    next(e);
  }
});

/* ================= PUBLIC PLANS (signup step) ================= */
r.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ amount: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        amount: true,     // bisa BigInt di DB
        currency: true,
        interval: true,
        active: true,
        priceId: true,    // gunakan ini untuk Payment Link ID (opsional)
        // OPTIONAL: payment link URL penuh, aktifkan hanya jika kolom ini memang ada di schema
        // paymentLinkUrl: true,
      },
    });

    // kirim amount sebagai number agar JSON valid saat kolomnya BigInt
    const serialized = (plans as any[]).map(p => ({ ...p, amount: Number(p.amount) }));
    res.json(serialized);
  } catch (e) {
    next(e);
  }
});

/* ================= CHECKOUT (buat transaksi Snap) ================= */
r.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { planId, employerId, customer, enabledPayments } = (req.body ?? {}) as any;
    if (!planId) return res.status(400).json({ error: 'Invalid params: planId required' });

    // userId boleh kosong saat alur signup
    const maybeUserId = getMaybeUserId(req);

    const tx = await createSnapForPlan({
      planId,
      userId: maybeUserId ?? null,
      employerId,
      customer,
      enabledPayments,
    });

    // isi nominal utk UI (optional)
    const plan = await prisma.plan.findFirst({
      where: { OR: [{ id: planId }, { slug: planId }] },
      select: { amount: true, currency: true },
    });

    res.json({
      token: (tx as any).token,
      redirect_url: (tx as any).redirect_url,
      orderId: (tx as any).order_id,
      amount: plan ? Number((plan as any).amount) : undefined,
      currency: plan?.currency ?? 'IDR',
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Internal server error' });
  }
});

/* ================= Webhook Midtrans ================= */
r.post('/midtrans/notify', async (req: Request, res: Response) => {
  try {
    const result = await handleMidtransNotification(req.body);
    if ((result as any)?.ok === false) {
      console.warn('Midtrans notify rejected:', result);
    }
  } catch (e) {
    console.error('Midtrans notify error:', e);
  }
  // selalu 200 agar Midtrans tidak spam retry
  res.status(200).json({ ok: true });
});

/* ================= Detail by orderId ================= */
r.get('/:orderId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pay = await prisma.payment.findUnique({ where: { orderId: req.params.orderId } });
    if (!pay) return res.status(404).json({ error: 'Not found' });
    res.json(pay);
  } catch (e) {
    next(e);
  }
});

export default r;

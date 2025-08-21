// src/services/employer.ts
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/hash';
// Jika di schema kamu ada enum OnboardingStep, aktifkan import di bawah:
// import { OnboardingStep, SubscriptionStatus } from '@prisma/client';

export async function checkAvailability(params: { slug?: string; email?: string }) {
  const { slug, email } = params;
  const checks: Record<string, boolean> = {};
  if (slug) {
    checks.slugTaken = !!(await prisma.employer.findUnique({
      where: { slug },
      select: { id: true }, // ⬅️ penting: hanya ambil kolom yang ada
    }));
  }
  if (email) {
    checks.emailTaken = !!(await prisma.employerAdminUser.findUnique({
      where: { email },
      select: { id: true }, // aman juga
    }));
  }
  return checks;
}

export async function createAccount(input: {
  companyName: string; displayName: string; email: string; website?: string; password: string;
}) {
  const base = input.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'company';
  let slug = base, i = 1;
  while (await prisma.employer.findUnique({
    where: { slug },
    select: { id: true }, // ⬅️ cegah P2022 saat kolom lain belum ada
  })) {
    slug = `${base}-${i++}`;
  }

  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    const employer = await tx.employer.create({
      data: {
        slug,
        legalName: input.companyName,
        displayName: input.displayName,
        website: input.website,
        status: 'draft', // atau enum jika ada
        // onboardingStep: OnboardingStep.PROFILE, // ⬅️ aktifkan jika enum sudah ada di schema
      },
      select: { id: true }, // cukup yang dibutuhkan
    });

    await tx.employerAdminUser.create({
      data: {
        employerId: employer.id,
        email: input.email,
        passwordHash,
        isOwner: true,
        agreedTosAt: new Date(),
      },
      select: { id: true },
    });

    return { employerId: employer.id };
  });

  return { employerId: result.employerId, slug };
}

export async function upsertProfile(employerId: string, profile: any) {
  await prisma.employerProfile.upsert({
    where: { employerId },
    update: profile,
    create: { employerId, ...profile },
  });

  // Jika pakai enum:
  // await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: OnboardingStep.PACKAGE } }).catch(() => {});
  await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: 'PACKAGE' } }).catch(() => {});
  return { ok: true };
}

export async function choosePlan(employerId: string, planSlug: string) {
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
    select: { id: true },
  });
  if (!plan) throw { status: 404, message: 'Plan not found' };

  await prisma.subscription.create({
    data: {
      employerId,
      planId: plan.id,
      status: 'active', // atau SubscriptionStatus.active jika enum ada
    },
    select: { id: true },
  });

  // Jika pakai enum:
  // await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: OnboardingStep.JOB } }).catch(() => {});
  await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: 'JOB' } }).catch(() => {});
  return { ok: true };
}

export async function createDraftJob(
  employerId: string,
  data: { title: string; description?: string; location?: string; employment?: string }
) {
  const job = await prisma.job.create({
    data: { employerId, ...data, isDraft: true, isActive: false },
    select: { id: true },
  });

  // Jika pakai enum:
  // await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: OnboardingStep.VERIFY } }).catch(() => {});
  await prisma.employer.update({ where: { id: employerId }, data: { onboardingStep: 'VERIFY' } }).catch(() => {});
  return { ok: true, jobId: job.id };
}

export async function submitVerification(
  employerId: string,
  note?: string,
  files?: { url: string; type?: string }[]
) {
  const vr = await prisma.$transaction(async (tx) => {
    const req = await tx.verificationRequest.create({
      data: { employerId, status: 'pending', note },
      select: { id: true },
    });

    if (files?.length) {
      await tx.verificationFile.createMany({
        data: files.map((f) => ({ verificationId: req.id, fileUrl: f.url, fileType: f.type })),
      });
    }

    // Jika pakai enum:
    // await tx.employer.update({ where: { id: employerId }, data: { onboardingStep: OnboardingStep.DONE } });
    await tx.employer.update({ where: { id: employerId }, data: { onboardingStep: 'DONE' } });
    return req;
  });

  return { ok: true, verificationId: vr.id };
}

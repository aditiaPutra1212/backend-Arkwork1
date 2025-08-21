import { z } from 'zod';

export const Step1Schema = z.object({
  companyName: z.string().min(2),
  displayName: z.string().min(2),
  email: z.string().email(),
  website: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  agree: z.literal(true)
}).refine(v => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export const Step2Schema = z.object({
  employerId: z.string().uuid(),
  industry: z.string().optional(),
  size: z.enum(['_1_10','_11_50','_51_200','_201_500','_501_1000','_1001_5000','_5001_10000','_10000plus']).optional(),
  foundedYear: z.number().int().gte(1800).lte(new Date().getFullYear()).optional(),
  about: z.string().max(5000).optional(),
  hqCity: z.string().optional(),
  hqCountry: z.string().optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
});

export const Step3Schema = z.object({
  employerId: z.string().uuid(),
  planSlug: z.string(),
});

export const Step4Schema = z.object({
  employerId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  location: z.string().optional(),
  employment: z.string().optional(),
});

export const Step5Schema = z.object({
  employerId: z.string().uuid(),
  note: z.string().optional(),
  files: z.array(z.object({ url: z.string().url(), type: z.string().optional() })).default([])
});

// src/routes/chat.ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

/* ====================== ENV ====================== */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

if (!GEMINI_API_KEY) {
  console.warn('[ArkWork Agent] GEMINI_API_KEY belum di-set (production akan gagal di /api/chat).');
}

/* ====================== TYPES ====================== */
type MsgIn = { role: string; content: string };

type Profile = {
  name?: string;
  role?: string;
  skills?: string;
  location?: string;
  experienceYears?: number;
  interests?: string;
};

/* ====================== VALIDATION ====================== */
const MsgSchema = z.object({
  role: z.string().default('user'),
  content: z.string().min(1),
});

const AskSchema = z.object({
  messages: z.array(MsgSchema).min(1),
  intent: z.enum(['news', 'jobs', 'consult']).default('news'),
  profile: z
    .object({
      name: z.string().optional(),
      role: z.string().optional(),
      skills: z.string().optional(),
      location: z.string().optional(),
      experienceYears: z.number().optional(),
      interests: z.string().optional(),
    })
    .optional(),
  maxOutputTokens: z.number().int().min(64).max(2048).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

/* ====================== HELPERS ====================== */

function clampText(s: string, max = 4000) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function toGeminiHistory(messages: MsgIn[], keep = 6) {
  // ambil beberapa pesan terakhir saja (biar hemat token)
  const recent = messages.slice(-keep);
  return recent
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: clampText(m.content, 4000) }],
    }));
}

function buildSystemPrompt(intent: string, profile?: Profile) {
  const base = `
Kamu adalah **ArkWork Agent**, asisten situs O&G Monitor.
Berbahasa Indonesia yang jelas, ringkas, dan ramah profesional.
Fokus domain utama: industri migas (oil & gas) Indonesia dan global, serta karier/skills terkait energi.

Aturan umum:
- Tulis jawaban terstruktur (bullet/nomor) bila cocok.
- Beri langkah praktis (step-by-step) dan sumber ide/ checklist.
- Jangan mengarang angka/fakta spesifik jika tidak yakin.
- Untuk saran karier/ konsultasi: jelaskan alasan & alternatif.
- Hindari klaim kesehatan/medis/keuangan/hukum spesifik; gunakan disclaimer ringan & sarankan ahli jika perlu.

Profil pengguna (opsional) untuk personalisasi:
${profile ? JSON.stringify(profile, null, 2) : '(tidak ada profil)'}
  `.trim();

  const modes: Record<string, string> = {
    news: `
Mode: **Berita**
- Jawab pertanyaan seputar berita migas, upstream/downstream, LNG, kebijakan, tender, dan tren harga (tanpa mengarang angka real-time).
- Jika diminta ringkas, buat ringkasan padat + poin penting dan konteks singkat.
- Boleh sarankan kata kunci yang bisa dicari di halaman O&G Monitor.`.trim(),
    jobs: `
Mode: **Rekomendasi Kerja**
- Beri rekomendasi role yang relevan dengan profil pengguna (skills/lokasi/pengalaman).
- Sertakan: jabatan target, alasan cocok, skills yang perlu ditingkatkan, sertifikasi opsional, contoh kata kunci lowongan, dan langkah 30/60/90 hari.
- Jika profil minim, tanyakan 1–2 klarifikasi singkat.`.trim(),
    consult: `
Mode: **Konsultasi**
- Jawab layaknya mentor: uraikan masalah, opsi solusi, trade-off, dan rencana aksi.
- Contoh topik: peningkatan skill, roadmap pindah role, efisiensi operasi, analitik produksi sederhana, dsb.
- Tutup dengan 3–5 next steps yang actionable.`.trim(),
  };

  const mode = modes[intent] || modes.news;
  return `${base}\n\n${mode}\n\nBalas ringkas, langsung ke inti, dan mudah dieksekusi.`;
}

/* ====================== ROUTES ====================== */

// Health check
router.get('/', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    model: GEMINI_MODEL,
    hasKey: !!GEMINI_API_KEY,
  });
});

// Main chat (POST /api/chat)
router.post('/', async (req: Request, res: Response) => {
  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY_MISSING',
      message: 'Server AI belum dikonfigurasi. Hubungi admin.',
    });
  }

  const parsed = AskSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      details: parsed.error.format(),
    });
  }

  const { messages, intent, profile, maxOutputTokens = 512, temperature = 0.3 } =
    parsed.data;

  // Ambil pesan terakhir (user) untuk dikirim sebagai query utama
  const user = messages[messages.length - 1]?.content || '';
  if (!user.trim()) {
    return res.json({
      answer:
        'Halo! Saya ArkWork Agent. Saya bisa bantu ringkas berita migas, rekomendasi kerja, dan konsultasi langkah praktis. Coba: "Berita LNG Indonesia terbaru dalam 3 poin."',
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const system = buildSystemPrompt(intent, profile);

    const chat = model.startChat({
      history: [
        // system prompt sebagai pesan awal
        { role: 'user', parts: [{ text: system }] },
        { role: 'model', parts: [{ text: 'Siap.' }] },
        // beberapa history terakhir
        ...toGeminiHistory(messages.slice(0, -1), 6),
      ],
      generationConfig: {
        maxOutputTokens,
        temperature,
      },
    });

    const result = await chat.sendMessage(clampText(user, 4000));
    const text = result.response?.text?.() || '';

    if (!text.trim()) {
      return res.status(502).json({
        error: 'EMPTY_RESPONSE',
        message: 'AI tidak mengembalikan teks.',
      });
    }

    return res.json({ answer: text.trim() });
  } catch (err: any) {
    // Logging detil ke server logs
    console.error('[ArkWork Agent] Gemini error:', {
      message: err?.message || err,
      code: err?.code,
      status: err?.status,
      name: err?.name,
    });

    // Jawaban singkat ke klien
    return res.status(502).json({
      error: 'AI_ERROR',
      code: err?.code || err?.status,
      message: err?.message || 'Gagal meminta jawaban dari AI.',
    });
  }
});

export default router;

import { Router, Request, Response } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash";

if (!GEMINI_API_KEY) {
  console.warn("[ArkWork Agent] GEMINI_API_KEY belum di-set.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");

type MsgIn = { role: string; content: string };
type Profile = {
  name?: string;
  role?: string;
  skills?: string;
  location?: string;
  experienceYears?: number;
  interests?: string;
};

function toGeminiHistory(messages: MsgIn[]) {
  return messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
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
- Hindari klaim kesehatan/medis/keuangan/ hukum spesifik; gunakan disclaimer ringan & sarankan ahli jika perlu.

Profil pengguna (opsional) untuk personalisasi:
${profile ? JSON.stringify(profile, null, 2) : "(tidak ada profil)"}  
`;

  const modes: Record<string, string> = {
    news: `
Mode: **Berita**
- Jawab pertanyaan seputar berita migas, upstream/downstream, LNG, kebijakan, tender, dan tren harga (tanpa mengarang angka real-time).
- Jika diminta ringkas, buat ringkasan padat + poin penting dan konteks singkat.
- Boleh sarankan kata kunci yang bisa dicari di halaman O&G Monitor.`,
    jobs: `
Mode: **Rekomendasi Kerja**
- Beri rekomendasi role yang relevan dengan profil pengguna (skills/lokasi/pengalaman).
- Sertakan: jabatan target, alasan cocok, skills yang perlu ditingkatkan, sertifikasi opsional, contoh kata kunci lowongan, dan langkah 30/60/90 hari.
- Jika profil minim, tanyakan 1–2 klarifikasi singkat.`,
    consult: `
Mode: **Konsultasi**
- Jawab layaknya mentor: uraikan masalah, opsi solusi, trade-off, dan rencana aksi.
- Contoh topik: peningkatan skill, roadmap pindah role, efisiensi operasi, analitik produksi sederhana, dsb.
- Tutup dengan 3–5 next steps yang actionable.`,
  };

  const mode = modes[intent] || modes.news;
  return base + "\n" + mode + "\nBalas ringkas, langsung ke inti, dan mudah dieksekusi.";
}

router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const messages = (body.messages ?? []) as MsgIn[];
    const user = messages[messages.length - 1]?.content || "";
    const intent: string = body.intent || "news";
    const profile: Profile | undefined = body.profile;

    if (!user?.trim()) {
      return res.json({
        answer:
          "Halo! Saya ArkWork Agent. Saya bisa bantu ringkas berita migas, rekomendasi kerja, dan konsultasi langkah praktis. Coba: 'Rekomendasikan role untuk operator kilang dengan pengalaman 2 tahun di Balikpapan.'",
      });
    }

    const system = buildSystemPrompt(intent, profile);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: system }] },
        { role: "model", parts: [{ text: "Siap." }] },
        ...toGeminiHistory(messages.slice(0, -1)),
      ],
    });

    const result = await chat.sendMessage(user);
    const text = result.response.text();

    return res.json({ answer: text?.trim() || "Maaf, saya tidak menemukan jawaban." });
  } catch (err) {
    console.error("[ArkWork Agent] Error:", err);
    return res.status(500).json({ answer: "Maaf, terjadi kesalahan di server." });
  }
});

export default router;

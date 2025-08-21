import axios from "axios";
import * as cheerio from "cheerio";

// Cache in-memory sederhana (TTL 6 jam)
const CACHE = new Map<string, { url: string | null; exp: number }>();
const TTL = 1000 * 60 * 60 * 6;

async function fetchHtml(url: string) {
  const resp = await axios.get(url, {
    timeout: 9000,
    maxRedirects: 5,
    headers: {
      "User-Agent": "arkwork-energy-news/1.0 (+og-image)",
      Accept: "text/html,application/xhtml+xml",
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });
  const finalUrl = resp.request?.res?.responseUrl || url;
  return { html: resp.data as string, finalUrl };
}

/** Jika halaman berasal dari news.google.com, cari URL media aslinya */
async function resolvePublisherUrlIfGoogle(url: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  if (u.hostname !== "news.google.com") return url;

  try {
    const { html, finalUrl } = await fetchHtml(url);
    const $ = cheerio.load(html);

    // 1) <link rel="canonical"> sering berisi URL publisher
    const canonical = $('link[rel="canonical"]').attr("href");
    if (canonical) return canonical;

    // 2) og:url
    const ogu = $('meta[property="og:url"]').attr("content");
    if (ogu) return ogu;

    // 3) Beberapa halaman punya <a ... href="?url=https://publisher.com/....">
    const aWithParam = $('a[href*="url="]').attr("href");
    if (aWithParam) {
      const href = new URL(aWithParam, finalUrl);
      const forwarded = href.searchParams.get("url");
      if (forwarded) return forwarded;
    }

    // 4) fallback: ambil link pertama yang keluar dari domain google (agak heuristik)
    const candidate = $('a[href^="http"]').toArray()
      .map((a) => $(a).attr("href")!)
      .find((h) => {
        try {
          const hu = new URL(h, finalUrl);
          return hu.hostname !== "news.google.com" && hu.hostname !== "www.google.com";
        } catch {
          return false;
        }
      });
    if (candidate) return new URL(candidate, finalUrl).toString();

    return url;
  } catch {
    return url;
  }
}

export async function getPreviewImage(pageUrl: string): Promise<string | null> {
  const now = Date.now();
  const cached = CACHE.get(pageUrl);
  if (cached && cached.exp > now) return cached.url;

  try {
    // Normalisasi: kalau link dari Google News, resolve ke publisher dulu
    const resolvedUrl = await resolvePublisherUrlIfGoogle(pageUrl);

    const { html, finalUrl } = await fetchHtml(resolvedUrl);
    const $ = cheerio.load(html);

    const candidates = [
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('link[rel="image_src"]').attr("href"),
    ].filter(Boolean) as string[];

    let img = candidates[0] || null;

    // Normalisasi ke absolute URL
    if (img && !/^https?:\/\//i.test(img)) {
      const base = new URL(finalUrl);
      img = new URL(img, base).toString();
    }

    CACHE.set(pageUrl, { url: img, exp: now + TTL });
    return img;
  } catch {
    CACHE.set(pageUrl, { url: null, exp: now + TTL });
    return null;
  }
}

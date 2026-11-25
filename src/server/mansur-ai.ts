import { GoogleGenAI } from '@google/genai';

export interface MansurAiHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

const MANSUR_AI_MODEL = 'gemini-4-hydrogen';

const MANSUR_AI_SYSTEM_INSTRUCTION = `Kamu adalah MANSUR AI, asisten konsultasi dan mentor edukasi trading profesional di aplikasi MANSUR ACADEMY (MANSYR404).

PERAN & KEPRIBADIAN:
- Ramah, sabar, tenang, suportif, dan profesional seperti mentor trading berpengalaman.
- Gunakan bahasa Indonesia yang hangat, jelas, mudah dipahami pemula maupun trader menengah, terstruktur, masuk akal, dan tidak bertele-tele.
- Tidak pernah menghakimi atau menyalahkan pengguna ketika mereka mengalami kerugian (loss), FOMO, overtrading, atau kesulitan belajar. Validasi perasaan mereka terlebih dahulu secara empatik, lalu bantu menganalisis akar kebiasaannya secara objektif.
- Jelaskan konsep secara bertahap dengan poin-poin singkat atau langkah konkret yang bisa langsung dipraktikkan dalam evaluasi jurnal dan kedisiplinan.

TOPIK YANG DIDUKUNG:
1. Materi & istilah trading (misalnya: liquidity, BOS/Break of Structure, CHOCH/Change of Character, supply & demand, support & resistance, order block, fair value gap, sesi market, spread/komisi/swap).
2. Strategi, penyusunan trading plan, aturan entry-exit berbasis edukasi, dan cara mengevaluasi setup secara objektif.
3. Psikologi trading (mengatasi takut entry setelah loss, revenge trading, serakah, tidak sabar, FOMO, konsistensi mental).
4. Manajemen risiko & pengelolaan modal (position sizing, penentuan risk-to-reward ratio, risiko per trade, batas kerugian harian, menjaga drawdown).
5. Memperbaiki kebiasaan, rutinitas evaluasi jurnal, dan kedisiplinan trading.

BATASAN MUTLAK (WAJIB DIPATUHI):
1. Kamu HANYA berfungsi sebagai AI tanya jawab, edukasi, dan konsultasi trading. Jangan melakukan analisis chart otomatis, memberikan sinyal trading (buy/sell pair tertentu saat ini), atau eksekusi order. Jika pengguna meminta sinyal entry saat ini atau menanyakan arah harga live, tolak dengan sopan dan jelaskan cara berpikir/kriteria edukatifnya saja.
2. JANGAN pernah menjanjikan keuntungan, profit konsisten instan, atau menyatakan bahwa suatu strategi pasti profit.
3. JANGAN pernah mengarang harga pasar saat ini, level harga live, angka berita ekonomi terkini, atau kondisi market real-time karena kamu tidak memiliki akses ke feed harga pasar real-time. Jika tidak yakin atau membutuhkan data live, katakan dengan jujur.
4. Berikan edukasi, kerangka berpikir, dan pertimbangan yang bijak tanpa memaksa pengguna mengambil keputusan transaksi tertentu.
5. Ingatkan secara natural dan proporsional bahwa aktivitas trading memiliki risiko kerugian finansial sehingga pengelolaan risiko dan disiplin selalu menjadi prioritas utama.

FORMAT JAWABAN:
- Panjang jawaban ideal sekitar 150–450 kata agar padat, rapi, dan nyaman dibaca di layar HP maupun desktop (boleh sedikit lebih rinci jika pengguna meminta penjelasan bertahap yang mendalam).
- Gunakan paragraf pendek dan poin bernomor atau bullet secukupnya agar mudah dipindai.`;

function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

export class MansurAiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MansurAiConfigError';
  }
}

export class MansurAiUpstreamError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = 'MansurAiUpstreamError';
    this.status = status;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new MansurAiConfigError(
      'GEMINI_API_KEY belum dikonfigurasi pada environment variable server.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function mapUpstreamGeminiError(error: any): MansurAiUpstreamError {
  const status = typeof error?.status === 'number' ? error.status : 502;
  const rawMessage = String(error?.message || '');
  const upper = rawMessage.toUpperCase();

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('PERMISSION_DENIED')
  ) {
    return new MansurAiUpstreamError(
      'API key Gemini tidak valid atau tidak memiliki izin akses. Periksa pengaturan GEMINI_API_KEY di server.',
      502
    );
  }

  if (status === 429 || upper.includes('RESOURCE_EXHAUSTED')) {
    return new MansurAiUpstreamError(
      'Batas permintaan MANSUR AI sedang penuh untuk sementara. Silakan tunggu beberapa saat lalu coba lagi.',
      429
    );
  }

  if (status === 404 || upper.includes('NOT_FOUND')) {
    return new MansurAiUpstreamError(
      'Model MANSUR AI sementara tidak tersedia. Silakan coba lagi beberapa saat lagi.',
      502
    );
  }

  return new MansurAiUpstreamError(
    'Gagal terhubung ke layanan MANSUR AI. Periksa koneksi server atau coba kirim ulang pertanyaan Anda.',
    502
  );
}

function isTransientError(error: any): boolean {
  const status = typeof error?.status === 'number' ? error.status : 0;
  const msg = String(error?.message || '').toLowerCase();
  return (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  );
}

export async function askMansurAi(params: {
  message: string;
  history: MansurAiHistoryItem[];
}): Promise<string> {
  const ai = getGeminiClient();

  const recentHistory = params.history
    .filter(
      (item) =>
        item &&
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim().length > 0
    )
    .slice(-18);

  const contents = [
    ...recentHistory.map((item) => ({
      role: item.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: item.content.trim() }],
    })),
    {
      role: 'user' as const,
      parts: [{ text: params.message.trim() }],
    },
  ];

  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MANSUR_AI_MODEL,
        contents,
        config: {
          systemInstruction: MANSUR_AI_SYSTEM_INSTRUCTION,
        },
      });

      const answer = (response.text ?? '').trim();
      if (!answer) {
        throw new MansurAiUpstreamError(
          'MANSUR AI tidak menghasilkan jawaban. Silakan coba rumuskan ulang pertanyaan Anda.',
          502
        );
      }
      return answer;
    } catch (error: any) {
      lastError = error;
      if (error instanceof MansurAiUpstreamError || error instanceof MansurAiConfigError) {
        throw error;
      }
      if (attempt === 0 && isTransientError(error)) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      throw mapUpstreamGeminiError(error);
    }
  }

  throw mapUpstreamGeminiError(lastError);
}

export function buildConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Konsultasi Trading';
  if (cleaned.length <= 52) return cleaned;
  return `${cleaned.slice(0, 49).trimEnd()}...`;
}

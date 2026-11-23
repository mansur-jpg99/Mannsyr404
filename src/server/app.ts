import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import dotenv from 'dotenv';
import {
  normalizeServerSupabaseUrl,
  requireAuth,
  type AuthRequest,
} from '../middleware/auth.ts';
import {
  createTradeScreenshot,
  createUserAccount,
  createUserReview,
  createUserTrade,
  deleteTradeScreenshot,
  deleteUserAccount,
  deleteUserReview,
  deleteUserTrade,
  getTradeScreenshots,
  getUserAccounts,
  getUserProfile,
  getUserReviews,
  getUserTrades,
  updateUserAccount,
  updateUserProfile,
  updateUserReview,
  updateUserTrade,
} from '../db/repository.ts';

dotenv.config();

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function registerApiRoutes(app: Express) {
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/auth-config', (_req, res) => {
    res.json({
      supabaseUrl: normalizeServerSupabaseUrl(
        stripQuotes(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
      ),
      supabaseAnonKey: stripQuotes(
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          ''
      ),
    });
  });

  app.get('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const [profile, accounts] = await Promise.all([
        getUserProfile(uid),
        getUserAccounts(uid),
      ]);
      res.json({ profile, accounts });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gagal memuat profil.' });
    }
  });

  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const fullName = String(req.body.fullName || '').trim();
      const traderStyle = String(
        req.body.traderStyle || 'Inner Circle Trader'
      ).trim();
      const updated = await updateUserProfile(uid, { fullName, traderStyle });
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memperbarui profil.' });
    }
  });

  app.get('/api/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accounts = await getUserAccounts(req.user!.uid);
      res.json(accounts);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memuat akun trading.' });
    }
  });

  app.post('/api/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const name = String(req.body.name || '').trim();
      const broker = String(req.body.broker || '').trim();
      const currency = ['IDR', 'USD', 'USC'].includes(req.body.currency)
        ? req.body.currency
        : 'USD';
      const initialBalance = Number(req.body.initialBalance);

      if (!name || Number.isNaN(initialBalance) || initialBalance < 0) {
        return res
          .status(400)
          .json({ error: 'Nama akun dan saldo awal wajib valid.' });
      }

      const account = await createUserAccount(req.user!.uid, {
        name,
        broker,
        currency,
        initialBalance,
      });
      res.status(201).json(account);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal membuat akun trading.' });
    }
  });

  app.put('/api/accounts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accountId = Number(req.params.id);
      const name = String(req.body.name || '').trim();
      const broker = String(req.body.broker || '').trim();
      const currency = ['IDR', 'USD', 'USC'].includes(req.body.currency)
        ? req.body.currency
        : 'USD';
      const initialBalance = Number(req.body.initialBalance);

      if (
        !accountId ||
        !name ||
        Number.isNaN(initialBalance) ||
        initialBalance < 0
      ) {
        return res.status(400).json({ error: 'Data akun tidak valid.' });
      }

      const updated = await updateUserAccount(req.user!.uid, accountId, {
        name,
        broker,
        currency,
        initialBalance,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Akun tidak ditemukan.' });
      }
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memperbarui akun.' });
    }
  });

  app.delete('/api/accounts/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accountId = Number(req.params.id);
      const deleted = await deleteUserAccount(req.user!.uid, accountId);
      if (!deleted) {
        return res.status(404).json({ error: 'Akun tidak ditemukan.' });
      }
      res.json({ deletedId: deleted.id });
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error.message || 'Gagal menghapus akun.' });
    }
  });

  app.get('/api/trades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accountId = req.query.accountId
        ? Number(req.query.accountId)
        : undefined;
      const items = await getUserTrades(req.user!.uid, accountId);
      res.json(items);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memuat transaksi.' });
    }
  });

  app.post('/api/trades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body;
      const accountId = Number(body.accountId);
      const entryPrice = Number(body.entryPrice);
      const stopLoss = Number(body.stopLoss);
      const takeProfit = Number(body.takeProfit);
      const lotSize = Number(body.lotSize);
      const exitPrice =
        body.exitPrice === null ||
        body.exitPrice === '' ||
        body.exitPrice === undefined
          ? null
          : Number(body.exitPrice);

      if (
        !accountId ||
        !body.tradeDate ||
        !body.pair ||
        !['BUY', 'SELL'].includes(body.direction) ||
        Number.isNaN(entryPrice) ||
        Number.isNaN(stopLoss) ||
        Number.isNaN(takeProfit) ||
        Number.isNaN(lotSize)
      ) {
        return res
          .status(400)
          .json({ error: 'Data transaksi tidak lengkap atau tidak valid.' });
      }

      const created = await createUserTrade(req.user!.uid, {
        accountId,
        tradeDate: String(body.tradeDate),
        tradeTime: String(body.tradeTime || '09:00'),
        pair: String(body.pair),
        direction: body.direction,
        entryPrice,
        exitPrice:
          exitPrice !== null && !Number.isNaN(exitPrice) ? exitPrice : null,
        stopLoss,
        takeProfit,
        lotSize,
        status: ['WIN', 'LOSS', 'BE', 'OPEN'].includes(body.status)
          ? body.status
          : 'OPEN',
        grossPl: Number(body.grossPl) || 0,
        commission: Number(body.commission) || 0,
        swap: Number(body.swap) || 0,
        netPl: Number(body.netPl) || 0,
        strategy: String(body.strategy || ''),
        session: String(body.session || 'London'),
        emotion: String(body.emotion || 'Tenang'),
        entryReason: String(body.entryReason || ''),
        notes: String(body.notes || ''),
      });

      res.status(201).json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal menyimpan transaksi.' });
    }
  });

  app.put('/api/trades/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tradeId = Number(req.params.id);
      const body = req.body;
      const accountId = Number(body.accountId);
      const entryPrice = Number(body.entryPrice);
      const stopLoss = Number(body.stopLoss);
      const takeProfit = Number(body.takeProfit);
      const lotSize = Number(body.lotSize);
      const exitPrice =
        body.exitPrice === null ||
        body.exitPrice === '' ||
        body.exitPrice === undefined
          ? null
          : Number(body.exitPrice);

      if (!tradeId || !accountId || !body.tradeDate || !body.pair) {
        return res
          .status(400)
          .json({ error: 'Data pembaruan transaksi tidak valid.' });
      }

      const updated = await updateUserTrade(req.user!.uid, tradeId, {
        accountId,
        tradeDate: String(body.tradeDate),
        tradeTime: String(body.tradeTime || '09:00'),
        pair: String(body.pair),
        direction: ['BUY', 'SELL'].includes(body.direction)
          ? body.direction
          : 'BUY',
        entryPrice,
        exitPrice:
          exitPrice !== null && !Number.isNaN(exitPrice) ? exitPrice : null,
        stopLoss,
        takeProfit,
        lotSize,
        status: ['WIN', 'LOSS', 'BE', 'OPEN'].includes(body.status)
          ? body.status
          : 'OPEN',
        grossPl: Number(body.grossPl) || 0,
        commission: Number(body.commission) || 0,
        swap: Number(body.swap) || 0,
        netPl: Number(body.netPl) || 0,
        strategy: String(body.strategy || ''),
        session: String(body.session || 'London'),
        emotion: String(body.emotion || 'Tenang'),
        entryReason: String(body.entryReason || ''),
        notes: String(body.notes || ''),
      });

      if (!updated) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      }
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memperbarui transaksi.' });
    }
  });

  app.delete('/api/trades/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const tradeId = Number(req.params.id);
      const deleted = await deleteUserTrade(req.user!.uid, tradeId);
      if (!deleted) {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
      }
      res.json({ deletedId: deleted.id });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal menghapus transaksi.' });
    }
  });

  app.get(
    '/api/trades/:id/screenshots',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const tradeId = Number(req.params.id);
        const items = await getTradeScreenshots(req.user!.uid, tradeId);
        res.json(items);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Gagal memuat screenshot.' });
      }
    }
  );

  app.post(
    '/api/trades/:id/screenshots',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const tradeId = Number(req.params.id);
        const stage = ['BEFORE', 'DURING', 'AFTER'].includes(req.body.stage)
          ? req.body.stage
          : 'BEFORE';
        const fileName = String(req.body.fileName || 'screenshot.jpg');
        const mimeType = String(req.body.mimeType || 'image/jpeg');
        const imageData = String(req.body.imageData || '');
        const caption = String(req.body.caption || '');

        if (!imageData.startsWith('data:image/')) {
          return res.status(400).json({ error: 'Format gambar tidak valid.' });
        }
        if (imageData.length > 8_000_000) {
          return res.status(400).json({ error: 'Ukuran gambar maksimal 5MB.' });
        }

        const created = await createTradeScreenshot(req.user!.uid, {
          tradeId,
          stage,
          fileName,
          mimeType,
          imageData,
          caption,
        });
        res.status(201).json(created);
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Gagal menyimpan screenshot.' });
      }
    }
  );

  app.delete(
    '/api/screenshots/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const screenshotId = Number(req.params.id);
        const deleted = await deleteTradeScreenshot(req.user!.uid, screenshotId);
        if (!deleted) {
          return res.status(404).json({ error: 'Screenshot tidak ditemukan.' });
        }
        res.json({ deletedId: deleted.id });
      } catch (error: any) {
        res
          .status(500)
          .json({ error: error.message || 'Gagal menghapus screenshot.' });
      }
    }
  );

  app.get('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accountId = req.query.accountId
        ? Number(req.query.accountId)
        : undefined;
      const items = await getUserReviews(req.user!.uid, accountId);
      res.json(items);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memuat evaluasi harian.' });
    }
  });

  app.post('/api/reviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const accountId = Number(req.body.accountId);
      const reviewDate = String(req.body.reviewDate || '');
      const emotionalState = String(req.body.emotionalState || '');
      const disciplineScore = Math.min(
        10,
        Math.max(1, Number(req.body.disciplineScore) || 8)
      );

      if (!accountId || !reviewDate || !emotionalState) {
        return res
          .status(400)
          .json({ error: 'Tanggal dan kondisi emosi wajib diisi.' });
      }

      const created = await createUserReview(req.user!.uid, {
        accountId,
        reviewDate,
        emotionalState,
        disciplineScore,
        mistakes: String(req.body.mistakes || ''),
        dailyReflection: String(req.body.dailyReflection || ''),
        progressNotes: String(req.body.progressNotes || ''),
      });
      res.status(201).json(created);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal menyimpan evaluasi harian.' });
    }
  });

  app.put('/api/reviews/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reviewId = Number(req.params.id);
      const accountId = Number(req.body.accountId);
      const reviewDate = String(req.body.reviewDate || '');
      const emotionalState = String(req.body.emotionalState || '');
      const disciplineScore = Math.min(
        10,
        Math.max(1, Number(req.body.disciplineScore) || 8)
      );

      if (!reviewId || !reviewDate || !emotionalState) {
        return res.status(400).json({ error: 'Data evaluasi tidak valid.' });
      }

      const updated = await updateUserReview(req.user!.uid, reviewId, {
        accountId,
        reviewDate,
        emotionalState,
        disciplineScore,
        mistakes: String(req.body.mistakes || ''),
        dailyReflection: String(req.body.dailyReflection || ''),
        progressNotes: String(req.body.progressNotes || ''),
      });
      if (!updated) {
        return res.status(404).json({ error: 'Evaluasi tidak ditemukan.' });
      }
      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal memperbarui evaluasi harian.' });
    }
  });

  app.delete('/api/reviews/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reviewId = Number(req.params.id);
      const deleted = await deleteUserReview(req.user!.uid, reviewId);
      if (!deleted) {
        return res.status(404).json({ error: 'Evaluasi tidak ditemukan.' });
      }
      res.json({ deletedId: deleted.id });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error.message || 'Gagal menghapus evaluasi harian.' });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });
}

export function registerApiErrorHandler(app: Express) {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) return;
    const status = typeof err?.status === 'number' ? err.status : 500;
    res.status(status).json({
      error: err?.message || 'Terjadi kesalahan internal pada server.',
    });
  });
}

export function createApiApp(): Express {
  const app = express();
  registerApiRoutes(app);
  registerApiErrorHandler(app);
  return app;
}

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import http from 'node:http';

// Routers
import authRouter from './routes/auth';
import newsRouter from './routes/news';
import chatRouter from './routes/chat';
import adminRouter from './routes/admin';
import { employerRouter } from './routes/employer';
import adminPlansRouter from './routes/admin-plans';
import paymentsRouter from './routes/payments';

// Middleware role-based auth (3 roles)
import { authRequired, employerRequired, adminRequired } from './middleware/role';

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEFAULT_PORT = Number(process.env.PORT) || 4000; // ⬅️ penting untuk Railway
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

/** ---------------- CORS ---------------- */
const origins = FRONTEND_ORIGIN.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/** --------------- Middlewares --------------- */
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/** --------------- Static --------------- */
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/** --------------- Health --------------- */
app.get('/', (_req, res) => res.send('OK'));
app.get('/health', (_req, res) => res.json({ ok: true }));

/** --------------- Routes --------------- */
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/news', newsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/employers', employerRouter);
app.use('/admin/plans', adminPlansRouter);
app.use('/api/payments', paymentsRouter);

/** ----------- Example protected routes ----------- */
app.get('/api/profile', authRequired, (req, res) => {
  res.json({ ok: true, whoami: (req as any).auth });
});

app.get('/api/employer/dashboard', employerRequired, (req, res) => {
  res.json({ ok: true, message: 'Employer-only area', whoami: (req as any).auth });
});

app.post('/api/admin/stats', adminRequired, (req, res) => {
  res.json({ ok: true, message: 'Admin-only area', whoami: (req as any).auth });
});

/** --------------- 404 (last) --------------- */
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

/** --------------- Error handler --------------- */
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

/** --------------- Listen --------------- */
function startServer(port: number) {
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log('========================================');
    console.log(`🚀 Backend listening on http://localhost:${port}`);
    console.log(`NODE_ENV           : ${NODE_ENV}`);
    console.log(`FRONTEND_ORIGIN(s) : ${origins.join(', ') || '(none)'}`);
    console.log('========================================');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
  });
}

startServer(DEFAULT_PORT);

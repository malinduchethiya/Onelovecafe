import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory sliding window rate limiter for public endpoints
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

// Server-side Zod validation schemas matching firebase-blueprint.json & firestore.rules
const ReservationPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid YYYY-MM-DD date'),
  time: z.string().min(4).max(10),
  servicePeriod: z.string().max(40).default('Evening Sanctuary'),
  partySize: z.number().int().min(1).max(20),
  tableId: z.string().min(1).max(40),
  tableLabel: z.string().min(1).max(40),
  zoneId: z.string().min(1).max(40),
  zoneName: z.string().min(1).max(60),
  guestName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  guestEmail: z.string().trim().email('Valid email address required').max(120),
  whatsapp: z.string().trim().min(5, 'Valid WhatsApp number required').max(30),
  country: z.string().trim().min(2, 'Country is required').max(80),
  occasion: z.string().max(60).default('None'),
  dietaryNotes: z.string().max(500).default(''),
  specialRequests: z.string().max(500).default(''),
  honeypot: z.string().max(0).optional(), // Anti-spam honeypot
});

const InquiryPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(40).default(''),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(1000),
  honeypot: z.string().max(0).optional(),
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '256kb' }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health & Diagnostics API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'onelove-cafe-sigiriya',
      timestamp: new Date().toISOString(),
    });
  });

  // Server-side Reservation Pre-Commit Validation & Rate Limiting
  app.post('/api/reservations/validate', (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`res_${clientIp}`, 15, 60_000)) {
      res.status(429).json({
        valid: false,
        error: 'Too many reservation attempts. Please wait a moment and try again.',
      });
      return;
    }

    const parsed = ReservationPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        valid: false,
        error: parsed.error.issues[0]?.message || 'Invalid reservation details.',
        issues: parsed.error.issues,
      });
      return;
    }

    // Generate cryptographically formatted reference code on server
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'OL-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    res.json({
      valid: true,
      referenceCode: code,
      sanitized: parsed.data,
      serverValidatedAt: new Date().toISOString(),
    });
  });

  // Server-side Inquiry Validation & Spam Protection
  app.post('/api/inquiries/validate', (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`inq_${clientIp}`, 10, 60_000)) {
      res.status(429).json({
        valid: false,
        error: 'Rate limit exceeded. Please wait a minute before sending another message.',
      });
      return;
    }

    const parsed = InquiryPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        valid: false,
        error: parsed.error.issues[0]?.message || 'Please check your inquiry fields.',
      });
      return;
    }

    res.json({
      valid: true,
      sanitized: parsed.data,
    });
  });

  // Dynamic SEO robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  // Dynamic SEO sitemap.xml
  app.get('/sitemap.xml', (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const routes = ['/', '/menu', '/story', '/gallery', '/events', '/contact', '/reserve'];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${baseUrl}${route}</loc>
    <changefreq>weekly</changefreq>
    <priority>${route === '/' || route === '/reserve' ? '1.0' : '0.8'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OneLove Café server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

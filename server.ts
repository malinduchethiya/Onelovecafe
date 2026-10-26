import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  DEFAULT_BRAND_FAVICON_PATH,
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './src/data/seoDefaults';
import { GlobalSeoConfig, PageSeoConfig, SeoPageKey } from './src/types/seo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEO_CACHE_FILE = path.join(__dirname, '.seo-runtime-cache.json');

interface SeoRuntimeState {
  global: GlobalSeoConfig;
  pages: Record<SeoPageKey, PageSeoConfig>;
}

function loadSeoState(): SeoRuntimeState {
  try {
    if (fs.existsSync(SEO_CACHE_FILE)) {
      const raw = fs.readFileSync(SEO_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SeoRuntimeState>;
      return {
        global: { ...DEFAULT_GLOBAL_SEO, ...(parsed.global || {}) },
        pages: { ...DEFAULT_PAGE_SEO, ...(parsed.pages || {}) },
      };
    }
  } catch {
    // Fallback to defaults if cache file is unreadable
  }
  return {
    global: { ...DEFAULT_GLOBAL_SEO },
    pages: { ...DEFAULT_PAGE_SEO },
  };
}

let seoState: SeoRuntimeState = loadSeoState();

function saveSeoStateToDisk(nextState: SeoRuntimeState) {
  seoState = nextState;
  try {
    fs.writeFileSync(SEO_CACHE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
  } catch {
    // Non-fatal in read-only environments
  }
}

function escapeHtmlAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectServerSeoIntoHtml(rawHtml: string, reqPath: string, hostHeader: string): string {
  const cleanPath = (reqPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const lower = cleanPath.toLowerCase();

  const { global: g, pages } = seoState;
  const domain = (g.canonicalDomain || 'https://onelovecafesigiriya.com').replace(/\/+$/, '');

  const isAdmin = lower === '/admin' || lower.startsWith('/admin/');
  const isVoucher = lower.startsWith('/reserve/voucher/');

  let pageKey: SeoPageKey | 'notfound' = 'notfound';
  if (lower === '/' || lower === '/index.html') pageKey = 'home';
  else if (lower === '/menu') pageKey = 'menu';
  else if (lower === '/reserve' || isVoucher) pageKey = 'reserve';
  else if (lower === '/story') pageKey = 'story';
  else if (lower === '/gallery') pageKey = 'gallery';
  else if (lower === '/contact' || lower === '/visit') pageKey = 'contact';
  else if (lower === '/events') pageKey = 'events';

  const activePage: PageSeoConfig =
    pageKey !== 'notfound' && pages[pageKey] ? pages[pageKey] : pages.home || DEFAULT_PAGE_SEO.home;

  let finalTitle = activePage.title || g.defaultTitle;
  let finalDesc = activePage.metaDescription || g.defaultDescription;
  let canonicalPath = activePage.canonicalPath || activePage.routePath || '/';

  if (isAdmin) {
    finalTitle = `SEO & Hospitality Admin Console | ${g.siteName || 'OneLove Café'}`;
    finalDesc = 'Protected administrative console for OneLove Café Sigiriya.';
    canonicalPath = '/admin';
  } else if (isVoucher) {
    finalTitle = `Reservation Voucher | ${g.siteName || 'OneLove Café'} Sigiriya`;
    finalDesc = 'Confirmed table reservation voucher at OneLove Café Sigiriya.';
    canonicalPath = '/reserve';
  } else if (pageKey === 'notfound') {
    finalTitle = `Page Not Found | ${g.siteName || 'OneLove Café'} Sigiriya`;
    finalDesc = g.defaultDescription;
    canonicalPath = cleanPath;
  }

  const canonicalUrl = `${domain}${
    canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`
  }`;

  const rawOgImg = activePage.ogImageUrl || g.defaultOgImageUrl || DEFAULT_BRAND_FAVICON_PATH;
  const ogImgUrl =
    rawOgImg.startsWith('http') || rawOgImg.startsWith('data:')
      ? rawOgImg
      : `${domain}${rawOgImg.startsWith('/') ? rawOgImg : `/${rawOgImg}`}`;

  const isPreviewHost =
    g.noindexPreviewDomains &&
    hostHeader &&
    !hostHeader.includes('onelovecafesigiriya.com') &&
    !hostHeader.includes('onelovecafe.lk');

  const shouldIndex =
    g.allowIndexing &&
    activePage.indexable &&
    !isAdmin &&
    !isVoucher &&
    pageKey !== 'notfound' &&
    !isPreviewHost;

  const robotsContent = shouldIndex
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow';

  const combinedKeywords = Array.from(
    new Set([
      activePage.primaryKeyword,
      ...(activePage.supportingKeywords || []),
      ...(g.alternateNames || []),
    ])
  )
    .filter(Boolean)
    .join(', ');

  let html = rawHtml;

  // Replace <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(finalTitle)}</title>`);

  // Replace meta description
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtmlAttr(finalDesc)}" />`
  );

  // Replace meta keywords
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="keywords" content="${escapeHtmlAttr(combinedKeywords)}" />`
  );

  // Replace meta robots
  html = html.replace(
    /<meta\s+name="robots"[^>]*\/?>/i,
    `<meta name="robots" id="meta-robots" content="${escapeHtmlAttr(robotsContent)}" />`
  );

  // Replace canonical link
  html = html.replace(
    /<link\s+rel="canonical"[^>]*\/?>/i,
    `<link rel="canonical" id="canonical-link" href="${escapeHtmlAttr(canonicalUrl)}" />`
  );

  // Replace Open Graph & Twitter tags
  const ogTitle = activePage.ogTitle || finalTitle;
  const ogDesc = activePage.ogDescription || finalDesc;

  html = html.replace(
    /<meta\s+property="og:site_name"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:site_name" content="${escapeHtmlAttr(g.siteName || 'OneLove Café')}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(ogDesc)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtmlAttr(ogImgUrl)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttr(ogDesc)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtmlAttr(ogImgUrl)}" />`
  );

  // Inject Google Search Console verification tag if configured
  if (g.googleVerificationTag && g.googleVerificationTag.trim()) {
    const cleanToken = g.googleVerificationTag
      .replace(/<meta[^>]*content=["']?([^"'>\s]+)["']?[^>]*>/i, '$1')
      .trim();
    if (cleanToken && !html.includes('google-site-verification')) {
      html = html.replace(
        '</head>',
        `    <meta name="google-site-verification" content="${escapeHtmlAttr(cleanToken)}" />\n  </head>`
      );
    }
  }

  // Replace JSON-LD script
  const jsonLdObj = buildStructuredDataGraph(g, activePage);
  html = html.replace(
    /<script\s+id="onelove-jsonld"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script id="onelove-jsonld" type="application/ld+json">\n${JSON.stringify(
      jsonLdObj,
      null,
      2
    )}\n    </script>`
  );

  return html;
}

// Serve dynamic or default binary favicon for Google Search crawler
function sendFaviconResponse(res: express.Response, customDataUrl: string | undefined) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (customDataUrl && customDataUrl.startsWith('data:image/')) {
    const matches = customDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (matches && matches[2]) {
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.status(200).send(buffer);
      return;
    }
  }

  const defaultAssetFile = path.join(
    __dirname,
    'public',
    DEFAULT_BRAND_FAVICON_PATH.replace(/^\//, '')
  );
  if (fs.existsSync(defaultAssetFile)) {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(defaultAssetFile);
    return;
  }

  res.status(404).end();
}

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

  app.use(express.json({ limit: '2mb' }));

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Public Google Search Favicon Endpoints (Multiples of 48px, 1:1 Square)
  app.get('/favicon.ico', (_req, res) => {
    sendFaviconResponse(res, seoState.global.favicon48Url || seoState.global.faviconSourceUrl);
  });

  app.get('/favicon-48x48.png', (_req, res) => {
    sendFaviconResponse(res, seoState.global.favicon48Url || seoState.global.faviconSourceUrl);
  });

  app.get('/favicon-96x96.png', (_req, res) => {
    sendFaviconResponse(res, seoState.global.favicon96Url || seoState.global.faviconSourceUrl);
  });

  app.get('/favicon-192x192.png', (_req, res) => {
    sendFaviconResponse(res, seoState.global.favicon192Url || seoState.global.faviconSourceUrl);
  });

  app.get('/apple-touch-icon.png', (_req, res) => {
    sendFaviconResponse(res, seoState.global.appleTouchIconUrl || seoState.global.faviconSourceUrl);
  });

  app.get('/api/seo/favicon', (_req, res) => {
    sendFaviconResponse(res, seoState.global.favicon96Url || seoState.global.faviconSourceUrl);
  });

  // Live SEO State Sync Endpoint (Receives updates from Firestore listener / Admin SEO Panel)
  app.post('/api/seo/sync', (req, res) => {
    try {
      const body = req.body || {};
      const nextGlobal: GlobalSeoConfig = {
        ...seoState.global,
        ...(body.global || {}),
      };
      const nextPages: Record<SeoPageKey, PageSeoConfig> = {
        ...seoState.pages,
        ...(body.pages || {}),
      };
      saveSeoStateToDisk({ global: nextGlobal, pages: nextPages });
      res.status(200).json({ ok: true, success: true });
    } catch (err) {
      res.status(400).json({
        ok: false,
        success: false,
        error: err instanceof Error ? err.message : 'Invalid SEO sync payload',
      });
    }
  });

  app.get('/api/seo/config', (_req, res) => {
    res.status(200).json({
      ok: true,
      success: true,
      global: seoState.global,
      pages: seoState.pages,
    });
  });

  // Health & Diagnostics API
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      success: true,
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
        ok: false,
        success: false,
        valid: false,
        error: 'Too many reservation attempts. Please wait a moment and try again.',
      });
      return;
    }

    const parsed = ReservationPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        success: false,
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

    res.status(200).json({
      ok: true,
      success: true,
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
        ok: false,
        success: false,
        valid: false,
        error: 'Rate limit exceeded. Please wait a minute before sending another message.',
      });
      return;
    }

    const parsed = InquiryPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        success: false,
        valid: false,
        error: parsed.error.issues[0]?.message || 'Please check your inquiry fields.',
      });
      return;
    }

    res.status(200).json({
      ok: true,
      success: true,
      valid: true,
      sanitized: parsed.data,
    });
  });

  // Catch-all for any other /api/* routes so they never return HTML or empty body
  app.all('/api/*', (_req, res) => {
    res.status(200).json({
      ok: true,
      success: true,
    });
  });

  // Dynamic SEO robots.txt
  app.get('/robots.txt', (_req, res) => {
    const baseUrl = (
      seoState.global.canonicalDomain ||
      process.env.APP_URL ||
      'https://onelovecafesigiriya.com'
    ).replace(/\/$/, '');

    const lines = [
      'User-agent: *',
      seoState.global.allowIndexing ? 'Allow: /' : 'Disallow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /admin/seo',
      'Disallow: /reserve/voucher/',
      'Disallow: /api/',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ];
    res.type('text/plain').send(lines.join('\n') + '\n');
  });

  // Dynamic SEO sitemap.xml
  app.get('/sitemap.xml', (_req, res) => {
    const baseUrl = (
      seoState.global.canonicalDomain ||
      process.env.APP_URL ||
      'https://onelovecafesigiriya.com'
    ).replace(/\/$/, '');
    const today = new Date().toISOString().slice(0, 10);

    const indexablePages = (Object.values(seoState.pages) as PageSeoConfig[]).filter(
      (p) => p.indexable
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexablePages
  .map((page) => {
    const route = page.canonicalPath.startsWith('/')
      ? page.canonicalPath
      : `/${page.canonicalPath}`;
    const priority =
      route === '/' ? '1.0' : route === '/reserve' || route === '/menu' ? '0.9' : '0.8';
    const changefreq = route === '/' || route === '/menu' || route === '/reserve' ? 'daily' : 'weekly';
    return `  <url>
    <loc>${baseUrl}${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;
    res.type('application/xml').send(xml);
  });

  const isProd =
    process.env.NODE_ENV === 'production' &&
    fs.existsSync(path.join(__dirname, 'dist', 'index.html'));

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    // Server-side HTML metadata & JSON-LD injection in development
    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const seoHtml = injectServerSeoIntoHtml(template, url, req.get('host') || '');
        res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      const rawHtml = fs.readFileSync(indexFile, 'utf-8');
      const seoHtml = injectServerSeoIntoHtml(rawHtml, req.originalUrl, req.get('host') || '');
      res.status(200).set({ 'Content-Type': 'text/html' }).send(seoHtml);
    });
  }

  // Global Express JSON error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({
      ok: false,
      success: false,
      error: err.message || 'Internal server error',
    });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OneLove Café server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

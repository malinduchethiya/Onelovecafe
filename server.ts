import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './src/data/seoDefaults';
import { PageSeoConfig, SeoPageKey } from './src/types/seo';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env files when running under Node / Express (non-overwriting)
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

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

  const g = DEFAULT_GLOBAL_SEO;
  const pages = DEFAULT_PAGE_SEO;
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
    pageKey !== 'notfound' && pages[pageKey] ? pages[pageKey] : pages.home;
  const lockedCanonicalPath =
    pageKey !== 'notfound' && pages[pageKey] ? pages[pageKey].canonicalPath : '/';

  let finalTitle = activePage.title || g.defaultTitle;
  let finalDesc = activePage.metaDescription || g.defaultDescription;
  let canonicalPath = lockedCanonicalPath;

  if (isAdmin) {
    finalTitle = `Admin Console | ${g.siteName || 'OneLove Café'}`;
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
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttr(finalTitle)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtmlAttr(finalDesc)}" />`
  );
  html = html.replace(
    /<meta\s+name="keywords"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="keywords" content="${escapeHtmlAttr(combinedKeywords)}" />`
  );
  html = html.replace(
    /<meta\s+name="robots"[^>]*\/?>/i,
    `<meta name="robots" id="meta-robots" content="${escapeHtmlAttr(robotsContent)}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"[^>]*\/?>/i,
    `<link rel="canonical" id="canonical-link" href="${escapeHtmlAttr(canonicalUrl)}" />`
  );

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
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttr(ogDesc)}" />`
  );

  if (!isAdmin) {
    const jsonLdGraph = buildStructuredDataGraph(g, {
      ...activePage,
      canonicalPath: lockedCanonicalPath,
    });
    const jsonLdScript = `<script id="onelove-jsonld" type="application/ld+json">\n${JSON.stringify(
      jsonLdGraph,
      null,
      2
    )}\n    </script>`;
    if (/<script\s+id="onelove-jsonld"[\s\S]*?<\/script>/i.test(html)) {
      html = html.replace(/<script\s+id="onelove-jsonld"[\s\S]*?<\/script>/i, jsonLdScript);
    } else {
      html = html.replace('</head>', `    ${jsonLdScript}\n  </head>`);
    }
  }

  return html;
}

// Simple per-IP upload rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

// Cloudflare R2 / S3-Compatible Object Storage Client (Images ONLY)
function getR2Client(): { s3: S3Client; bucket: string; publicUrl: string } | null {
  const accountId = (
    process.env.R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID ||
    ''
  ).trim();
  const accessKeyId = (
    process.env.R2_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    ''
  ).trim();
  const secretAccessKey = (
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    ''
  ).trim();
  const bucket = (
    process.env.R2_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    'onelove-assets'
  ).trim();
  const publicUrl = (
    process.env.R2_PUBLIC_URL ||
    process.env.S3_PUBLIC_URL ||
    process.env.AWS_S3_PUBLIC_URL ||
    'https://cdn.onelovecafesigiriya.com'
  ).trim();
  const region = (process.env.S3_REGION || process.env.AWS_REGION || 'auto').trim();

  let endpoint = (
    process.env.R2_ENDPOINT ||
    process.env.S3_ENDPOINT ||
    process.env.AWS_ENDPOINT ||
    ''
  ).trim();
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  const s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { s3, bucket, publicUrl };
}

function extractR2KeyFromUrl(url: string | undefined, publicUrl: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  const cleanPublic = (publicUrl || 'https://cdn.onelovecafesigiriya.com').replace(/\/+$/, '');
  if (trimmed.startsWith(cleanPublic + '/')) {
    return trimmed.slice(cleanPublic.length + 1).split('?')[0];
  }
  if (trimmed.startsWith('https://cdn.onelovecafesigiriya.com/')) {
    return trimmed.slice('https://cdn.onelovecafesigiriya.com/'.length).split('?')[0];
  }
  return null;
}

async function deleteObjectFromR2Bucket(keyOrUrl: string): Promise<string | null> {
  const r2 = getR2Client();
  if (!r2 || !keyOrUrl) return null;
  const extractedKey =
    keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')
      ? extractR2KeyFromUrl(keyOrUrl, r2.publicUrl)
      : keyOrUrl.replace(/^\/+/, '');
  if (!extractedKey) return null;

  await r2.s3.send(
    new DeleteObjectCommand({
      Bucket: r2.bucket,
      Key: extractedKey,
    })
  );
  return extractedKey;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));

  // Security headers & canonical 301 redirect from www to non-www production domain
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const host = rawHost.split(',')[0].trim().toLowerCase();
    if (host.startsWith('www.onelovecafesigiriya.com') || host.startsWith('www.onelovecafe.lk')) {
      const canonicalDomain = (
        DEFAULT_GLOBAL_SEO.canonicalDomain || 'https://onelovecafesigiriya.com'
      ).replace(/\/+$/, '');
      res.redirect(301, `${canonicalDomain}${req.originalUrl || '/'}`);
      return;
    }

    next();
  });

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      success: true,
      status: 'ok',
      service: 'onelove-cafe-sigiriya',
      timestamp: new Date().toISOString(),
    });
  });

  // Cloudflare R2 Storage Status Endpoint
  app.get('/api/storage/status', (_req, res) => {
    const r2 = getR2Client();
    const publicBase = r2?.publicUrl ? r2.publicUrl.replace(/\/$/, '') : null;
    res.status(200).json({
      ok: true,
      success: true,
      configured: Boolean(r2),
      provider: r2 ? 'cloudflare-r2' : 'unconfigured',
      bucket: r2?.bucket || null,
      publicUrl: publicBase,
    });
  });

  // Cloudflare R2 Image Upload Endpoint (Admin -> R2 -> returns public CDN URL to save in Firestore)
  app.post('/api/upload', async (req, res) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`upload_${clientIp}`, 30, 60_000)) {
      res.status(429).json({
        ok: false,
        success: false,
        error: 'Upload rate limit reached. Please wait a moment and try again.',
      });
      return;
    }

    try {
      const { dataUrl, filename, folder, previousUrl } = req.body || {};
      if (!dataUrl || typeof dataUrl !== 'string') {
        res.status(400).json({
          ok: false,
          success: false,
          error: 'dataUrl is required for image upload.',
        });
        return;
      }

      const r2 = getR2Client();
      if (!r2) {
        res.status(503).json({
          ok: false,
          success: false,
          configured: false,
          error:
            'Cloudflare R2 credentials are missing on this server. Set R2_ACCOUNT_ID (or S3_ENDPOINT), R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in your environment.',
        });
        return;
      }

      const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!matches || !matches[2]) {
        res.status(400).json({
          ok: false,
          success: false,
          error: 'Invalid image dataUrl format.',
        });
        return;
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');

      const ext = mimeType.replace('image/', '').replace('jpeg', 'jpg');
      const safeFolder = (folder || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
      const rawName = (filename || 'image')
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 40);
      const key = `${safeFolder}/${Date.now()}-${rawName}.${ext}`;

      await r2.s3.send(
        new PutObjectCommand({
          Bucket: r2.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      let deletedPreviousKey: string | null = null;
      if (typeof previousUrl === 'string' && previousUrl.trim()) {
        deletedPreviousKey = await deleteObjectFromR2Bucket(previousUrl).catch(() => null);
      }

      const publicBase = r2.publicUrl.replace(/\/$/, '');
      const publicUrl = publicBase ? `${publicBase}/${key}` : `/${key}`;

      res.status(200).json({
        ok: true,
        success: true,
        url: publicUrl,
        key,
        deletedPreviousKey,
        storage: 'r2',
        size: buffer.length,
      });
    } catch (err) {
      console.error('Cloudflare R2 upload error:', err);
      res.status(500).json({
        ok: false,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to upload image to Cloudflare R2.',
      });
    }
  });

  // Cloudflare R2 Image Delete Endpoint
  app.post('/api/storage/delete', async (req, res) => {
    try {
      const { url, urls, key } = req.body || {};
      const targets: string[] = [];
      if (typeof key === 'string' && key.trim()) targets.push(key.trim());
      if (typeof url === 'string' && url.trim()) targets.push(url.trim());
      if (Array.isArray(urls)) {
        urls.forEach((u) => {
          if (typeof u === 'string' && u.trim()) targets.push(u.trim());
        });
      }

      const deletedKeys: string[] = [];
      for (const target of targets) {
        const deleted = await deleteObjectFromR2Bucket(target).catch(() => null);
        if (deleted) deletedKeys.push(deleted);
      }

      res.status(200).json({
        ok: true,
        success: true,
        deletedKeys,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to delete object from R2',
      });
    }
  });

  // Reject any unknown /api/* route cleanly
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      ok: false,
      success: false,
      error: 'API route not found',
    });
  });

  // robots.txt
  app.get('/robots.txt', (_req, res) => {
    const baseUrl = (
      DEFAULT_GLOBAL_SEO.canonicalDomain ||
      process.env.APP_URL ||
      'https://onelovecafesigiriya.com'
    ).replace(/\/$/, '');

    const lines = [
      'User-agent: *',
      DEFAULT_GLOBAL_SEO.allowIndexing ? 'Allow: /' : 'Disallow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /admin/seo',
      'Disallow: /reserve/voucher/',
      'Disallow: /api/',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ];
    res.type('text/plain').send(lines.join('\n') + '\n');
  });

  // sitemap.xml
  app.get('/sitemap.xml', (_req, res) => {
    const baseUrl = (
      DEFAULT_GLOBAL_SEO.canonicalDomain ||
      process.env.APP_URL ||
      'https://onelovecafesigiriya.com'
    ).replace(/\/$/, '');
    const today = new Date().toISOString().slice(0, 10);

    const indexablePages = (Object.values(DEFAULT_PAGE_SEO) as PageSeoConfig[]).filter(
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
    const changefreq =
      route === '/' || route === '/menu' || route === '/reserve' ? 'daily' : 'weekly';
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
    app.use(express.static(path.join(__dirname, 'public'), { index: false }));

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`OneLove Café server listening on http://0.0.0.0:${PORT}`);
    });

    let viteReady: Awaited<ReturnType<typeof createViteServer>> | null = null;
    const vitePromise = createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'custom',
      optimizeDeps: { entries: ['index.html'] },
    }).then((v) => {
      viteReady = v;
      return v;
    });

    app.use(async (req, res, next) => {
      try {
        if (!viteReady && (req.path === '/' || req.path === '/index.html')) {
          const templatePath = path.resolve(__dirname, 'index.html');
          const rawHtml = fs.readFileSync(templatePath, 'utf-8');
          const seoHtml = injectServerSeoIntoHtml(rawHtml, req.originalUrl, req.get('host') || '');
          res.status(200).set({ 'Content-Type': 'text/html' }).end(seoHtml);
          return;
        }
        const vite = viteReady || (await vitePromise);
        vite.middlewares(req, res, next);
      } catch (e) {
        next(e);
      }
    });

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        if (viteReady) {
          template = await viteReady.transformIndexHtml(url, template);
        }
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

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({
        ok: false,
        success: false,
        error: err.message || 'Internal server error',
      });
    }
  );

  if (isProd) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`OneLove Café server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

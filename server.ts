import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DEFAULT_BRAND_FAVICON_PATH,
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './src/data/seoDefaults';
import { GlobalSeoConfig, PageSeoConfig, SeoPageKey } from './src/types/seo';
import { R2MediaManifest } from './src/types/cafe';
import { DEFAULT_GALLERY, DEFAULT_SETTINGS } from './src/data/seedData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SEO_CACHE_FILE = path.join(__dirname, '.seo-runtime-cache.json');
const R2_MANIFEST_CACHE_FILE = path.join(__dirname, '.r2-manifest-cache.json');
const R2_MANIFEST_OBJECT_KEY = 'manifest/site-media.json';

interface SeoRuntimeState {
  global: GlobalSeoConfig;
  pages: Record<SeoPageKey, PageSeoConfig>;
}

function normalizeRuntimeSeoState(rawState: Partial<SeoRuntimeState>): SeoRuntimeState {
  const globalConfig: GlobalSeoConfig = {
    ...DEFAULT_GLOBAL_SEO,
    ...(rawState.global || {}),
  };

  if (
    !globalConfig.defaultTitle ||
    globalConfig.defaultTitle.includes('Breakfast, Brunch & Coffee')
  ) {
    globalConfig.defaultTitle = DEFAULT_GLOBAL_SEO.defaultTitle;
  }
  if (
    !globalConfig.defaultDescription ||
    globalConfig.defaultDescription.includes('Enjoy specialty coffee, fresh smoothie bowls')
  ) {
    globalConfig.defaultDescription = DEFAULT_GLOBAL_SEO.defaultDescription;
  }
  if (!globalConfig.telephone || globalConfig.telephone === '+94 66 228 6410') {
    globalConfig.telephone = DEFAULT_GLOBAL_SEO.telephone;
  }
  globalConfig.alternateNames = Array.from(
    new Set([...(DEFAULT_GLOBAL_SEO.alternateNames || []), ...(globalConfig.alternateNames || [])])
  );

  const pagesConfig: Record<SeoPageKey, PageSeoConfig> = {
    ...DEFAULT_PAGE_SEO,
    ...(rawState.pages || {}),
  };

  if (
    pagesConfig.home &&
    (!pagesConfig.home.title || pagesConfig.home.title.includes('Breakfast, Brunch & Coffee'))
  ) {
    pagesConfig.home = {
      ...pagesConfig.home,
      title: DEFAULT_PAGE_SEO.home.title,
      ogTitle: DEFAULT_PAGE_SEO.home.ogTitle,
    };
  }
  if (
    pagesConfig.home &&
    (!pagesConfig.home.metaDescription ||
      pagesConfig.home.metaDescription.includes('Enjoy specialty coffee, fresh smoothie bowls'))
  ) {
    pagesConfig.home = {
      ...pagesConfig.home,
      metaDescription: DEFAULT_PAGE_SEO.home.metaDescription,
      ogDescription: DEFAULT_PAGE_SEO.home.ogDescription,
    };
  }

  return {
    global: globalConfig,
    pages: pagesConfig,
  };
}

function loadSeoState(): SeoRuntimeState {
  try {
    if (fs.existsSync(SEO_CACHE_FILE)) {
      const raw = fs.readFileSync(SEO_CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SeoRuntimeState>;
      return normalizeRuntimeSeoState(parsed);
    }
  } catch {
    // Fallback to defaults if cache file is unreadable
  }
  return normalizeRuntimeSeoState({});
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

// Cloudflare R2 / S3-Compatible Object Storage Client
function getR2Client(): { s3: S3Client; bucket: string; publicUrl: string } | null {
  const accountId = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;
  const bucket =
    process.env.R2_BUCKET_NAME ||
    process.env.S3_BUCKET_NAME ||
    process.env.AWS_S3_BUCKET ||
    'onelove-assets';
  const publicUrl =
    process.env.R2_PUBLIC_URL ||
    process.env.S3_PUBLIC_URL ||
    process.env.AWS_S3_PUBLIC_URL ||
    'https://cdn.onelovecafesigiriya.com';
  const region = process.env.S3_REGION || process.env.AWS_REGION || 'auto';

  // Endpoint can be directly passed (e.g., https://<account_id>.r2.cloudflarestorage.com) or inferred
  let endpoint = process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT;
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  const s3 = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { s3, bucket, publicUrl };
}

function createDefaultR2Manifest(): R2MediaManifest {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    heroImages: DEFAULT_SETTINGS.heroImages || ['editorial:hero-sanctuary'],
    heroSlideshowSpeedSeconds: DEFAULT_SETTINGS.heroSlideshowSpeedSeconds || 5,
    floorPlanImageUrl: DEFAULT_SETTINGS.floorPlanImageUrl || '',
    menuImages: {},
    galleryItems: DEFAULT_GALLERY.map((g) => ({ ...g })),
    eventImages: {},
    sectionImages: {},
    seoImages: {},
  };
}

function normalizeR2Manifest(raw: Partial<R2MediaManifest> | null | undefined): R2MediaManifest {
  const base = createDefaultR2Manifest();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: typeof raw.version === 'number' ? raw.version : base.version,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt,
    heroImages:
      Array.isArray(raw.heroImages) && raw.heroImages.length > 0
        ? raw.heroImages.filter((u) => typeof u === 'string' && u.trim().length > 0)
        : base.heroImages,
    heroSlideshowSpeedSeconds:
      typeof raw.heroSlideshowSpeedSeconds === 'number'
        ? raw.heroSlideshowSpeedSeconds
        : base.heroSlideshowSpeedSeconds,
    floorPlanImageUrl:
      typeof raw.floorPlanImageUrl === 'string' ? raw.floorPlanImageUrl : base.floorPlanImageUrl,
    menuImages:
      raw.menuImages && typeof raw.menuImages === 'object' ? { ...raw.menuImages } : {},
    galleryItems:
      Array.isArray(raw.galleryItems) && raw.galleryItems.length > 0
        ? raw.galleryItems
        : base.galleryItems,
    eventImages:
      raw.eventImages && typeof raw.eventImages === 'object' ? { ...raw.eventImages } : {},
    sectionImages:
      raw.sectionImages && typeof raw.sectionImages === 'object' ? { ...raw.sectionImages } : {},
    seoImages:
      raw.seoImages && typeof raw.seoImages === 'object' ? { ...raw.seoImages } : {},
  };
}

function loadLocalManifestCache(): R2MediaManifest {
  try {
    if (fs.existsSync(R2_MANIFEST_CACHE_FILE)) {
      const raw = fs.readFileSync(R2_MANIFEST_CACHE_FILE, 'utf-8');
      return normalizeR2Manifest(JSON.parse(raw) as Partial<R2MediaManifest>);
    }
  } catch {
    // Fallback to default
  }
  return createDefaultR2Manifest();
}

let r2ManifestState: R2MediaManifest = loadLocalManifestCache();
let r2ManifestLoadedFromBucket = false;

function saveLocalManifestCache(manifest: R2MediaManifest) {
  r2ManifestState = manifest;
  try {
    fs.writeFileSync(R2_MANIFEST_CACHE_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
  } catch {
    // Ignore read-only filesystem errors
  }
}

function extractR2KeyFromUrl(url: string | undefined, publicUrl: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('editorial:')) return null;
  const cleanPublic = (publicUrl || 'https://cdn.onelovecafesigiriya.com').replace(/\/+$/, '');
  if (trimmed.startsWith(cleanPublic + '/')) {
    return trimmed.slice(cleanPublic.length + 1).split('?')[0];
  }
  if (trimmed.startsWith('https://cdn.onelovecafesigiriya.com/')) {
    return trimmed.slice('https://cdn.onelovecafesigiriya.com/'.length).split('?')[0];
  }
  return null;
}

async function fetchManifestFromR2Bucket(forceRefresh = false): Promise<R2MediaManifest> {
  const r2 = getR2Client();
  if (!r2) return r2ManifestState;
  if (r2ManifestLoadedFromBucket && !forceRefresh) return r2ManifestState;

  try {
    const resp = await r2.s3.send(
      new GetObjectCommand({
        Bucket: r2.bucket,
        Key: R2_MANIFEST_OBJECT_KEY,
      })
    );
    if (resp.Body) {
      const text = await resp.Body.transformToString('utf-8');
      const parsed = normalizeR2Manifest(JSON.parse(text) as Partial<R2MediaManifest>);
      saveLocalManifestCache(parsed);
      r2ManifestLoadedFromBucket = true;
      return parsed;
    }
  } catch (err: unknown) {
    const errName = err && typeof err === 'object' && 'name' in err ? String((err as { name?: string }).name) : '';
    if (errName === 'NoSuchKey' || errName === 'NotFound') {
      // Initialize manifest/site-media.json in the R2 bucket for the first time
      try {
        await writeManifestToR2Bucket(r2ManifestState);
        r2ManifestLoadedFromBucket = true;
      } catch {
        // Non-fatal
      }
    }
  }
  return r2ManifestState;
}

async function writeManifestToR2Bucket(manifest: R2MediaManifest): Promise<string | null> {
  const normalized = normalizeR2Manifest(manifest);
  saveLocalManifestCache(normalized);
  const r2 = getR2Client();
  if (!r2) return null;

  const bodyStr = JSON.stringify(normalized, null, 2);
  await r2.s3.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: R2_MANIFEST_OBJECT_KEY,
      Body: Buffer.from(bodyStr, 'utf-8'),
      ContentType: 'application/json; charset=utf-8',
      CacheControl: 'public, max-age=5, must-revalidate',
    })
  );
  r2ManifestLoadedFromBucket = true;
  const publicBase = r2.publicUrl.replace(/\/$/, '');
  return `${publicBase}/${R2_MANIFEST_OBJECT_KEY}`;
}

async function deleteObjectFromR2Bucket(keyOrUrl: string): Promise<string | null> {
  const r2 = getR2Client();
  if (!r2 || !keyOrUrl) return null;
  const extractedKey =
    keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')
      ? extractR2KeyFromUrl(keyOrUrl, r2.publicUrl)
      : keyOrUrl.replace(/^\/+/, '');
  if (!extractedKey || extractedKey === R2_MANIFEST_OBJECT_KEY) return null;

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

  // Warm up R2 media manifest on boot
  fetchManifestFromR2Bucket().catch(() => {});

  app.use(express.json({ limit: '20mb' }));

  // Security headers & canonical 301 redirect from www to non-www production domain
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    const rawHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const host = rawHost.split(',')[0].trim().toLowerCase();
    if (host.startsWith('www.onelovecafesigiriya.com') || host.startsWith('www.onelovecafe.lk')) {
      const canonicalDomain = (
        seoState.global.canonicalDomain || 'https://onelovecafesigiriya.com'
      ).replace(/\/+$/, '');
      res.redirect(301, `${canonicalDomain}${req.originalUrl || '/'}`);
      return;
    }

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
      const normalized = normalizeRuntimeSeoState({
        global: { ...seoState.global, ...(body.global || {}) },
        pages: { ...seoState.pages, ...(body.pages || {}) },
      });
      saveSeoStateToDisk(normalized);
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

  // Cloudflare R2 Storage Status Endpoint
  app.get('/api/storage/status', (_req, res) => {
    const r2 = getR2Client();
    const publicBase = r2?.publicUrl ? r2.publicUrl.replace(/\/$/, '') : null;
    res.status(200).json({
      ok: true,
      success: true,
      configured: Boolean(r2),
      provider: r2 ? 'cloudflare-r2' : 'inline',
      bucket: r2?.bucket || null,
      publicUrl: publicBase,
      manifestUrl: publicBase ? `${publicBase}/${R2_MANIFEST_OBJECT_KEY}` : null,
    });
  });

  // Cloudflare R2 Media Manifest GET Endpoint (100% R2-backed image catalog, zero Firestore reads)
  app.get('/api/storage/manifest', async (req, res) => {
    try {
      const force = req.query.refresh === '1';
      const manifest = await fetchManifestFromR2Bucket(force);
      const r2 = getR2Client();
      const publicBase = r2?.publicUrl ? r2.publicUrl.replace(/\/$/, '') : null;
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        ok: true,
        success: true,
        configured: Boolean(r2),
        source: r2 ? 'cloudflare-r2' : 'local-cache',
        manifestUrl: publicBase ? `${publicBase}/${R2_MANIFEST_OBJECT_KEY}` : null,
        manifest,
      });
    } catch (err) {
      res.status(200).json({
        ok: true,
        success: true,
        configured: false,
        source: 'fallback',
        manifest: r2ManifestState,
        error: err instanceof Error ? err.message : undefined,
      });
    }
  });

  // Cloudflare R2 Media Manifest POST Endpoint (Updates manifest/site-media.json directly inside R2)
  app.post('/api/storage/manifest', async (req, res) => {
    try {
      const current = await fetchManifestFromR2Bucket(false);
      const rawBody = (req.body || {}) as Record<string, unknown>;
      const hasNestedManifest =
        Boolean(rawBody.manifest) &&
        typeof rawBody.manifest === 'object' &&
        !Array.isArray(rawBody.manifest);
      const patch = (hasNestedManifest ? rawBody.manifest : rawBody) as Partial<R2MediaManifest> & {
        deleteUrls?: string[];
      };
      const deleteUrls = Array.isArray(rawBody.deleteUrls)
        ? (rawBody.deleteUrls as string[])
        : Array.isArray(patch.deleteUrls)
        ? patch.deleteUrls
        : [];

      // If caller requested deleting specific old R2 image URLs simultaneously
      if (deleteUrls.length > 0) {
        for (const u of deleteUrls) {
          if (typeof u === 'string' && u.trim()) {
            await deleteObjectFromR2Bucket(u).catch(() => {});
          }
        }
      }

      const mergedMenuImages = hasNestedManifest
        ? { ...(patch.menuImages || {}) }
        : { ...current.menuImages, ...(patch.menuImages || {}) };
      Object.keys(mergedMenuImages).forEach((k) => {
        if (!mergedMenuImages[k]) delete mergedMenuImages[k];
      });

      const mergedEventImages = hasNestedManifest
        ? { ...(patch.eventImages || {}) }
        : { ...current.eventImages, ...(patch.eventImages || {}) };
      Object.keys(mergedEventImages).forEach((k) => {
        if (!mergedEventImages[k]) delete mergedEventImages[k];
      });

      const mergedSectionImages = hasNestedManifest
        ? { ...(patch.sectionImages || {}) }
        : { ...current.sectionImages, ...(patch.sectionImages || {}) };
      Object.keys(mergedSectionImages).forEach((k) => {
        if (!mergedSectionImages[k]) delete mergedSectionImages[k];
      });

      const mergedSeoImages = {
        ...current.seoImages,
        ...(patch.seoImages || {}),
        pageOgImages: hasNestedManifest
          ? { ...(patch.seoImages?.pageOgImages || {}) }
          : {
              ...(current.seoImages?.pageOgImages || {}),
              ...(patch.seoImages?.pageOgImages || {}),
            },
      };

      const nextManifest: R2MediaManifest = normalizeR2Manifest({
        version: (current.version || 1) + 1,
        updatedAt: new Date().toISOString(),
        heroImages: patch.heroImages !== undefined ? patch.heroImages : current.heroImages,
        heroSlideshowSpeedSeconds:
          patch.heroSlideshowSpeedSeconds !== undefined
            ? patch.heroSlideshowSpeedSeconds
            : current.heroSlideshowSpeedSeconds,
        floorPlanImageUrl:
          patch.floorPlanImageUrl !== undefined
            ? patch.floorPlanImageUrl
            : current.floorPlanImageUrl,
        menuImages: mergedMenuImages,
        galleryItems: patch.galleryItems !== undefined ? patch.galleryItems : current.galleryItems,
        eventImages: mergedEventImages,
        sectionImages: mergedSectionImages,
        seoImages: mergedSeoImages,
      });

      const manifestUrl = await writeManifestToR2Bucket(nextManifest);

      res.status(200).json({
        ok: true,
        success: true,
        storage: manifestUrl ? 'r2' : 'local',
        manifestUrl,
        manifest: nextManifest,
      });
    } catch (err) {
      console.error('Failed to update R2 manifest:', err);
      res.status(500).json({
        ok: false,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update R2 manifest',
      });
    }
  });

  // Cloudflare R2 Object Delete Endpoint (Physically deletes image object from R2 bucket)
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

  // Cloudflare R2 Secure Upload Endpoint (Uploads new image & automatically cleans up replaced R2 object)
  app.post('/api/upload', async (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
        // Fallback: If R2 is not configured in environment, return the compressed dataUrl
        res.status(200).json({
          ok: true,
          success: true,
          url: dataUrl,
          storage: 'inline',
          configured: false,
          message: 'Cloudflare R2 credentials not configured; stored as inline payload.',
        });
        return;
      }

      // Parse base64 dataUrl
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

      // Sanitize extension and folder
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

      // If replacing a previous R2 image, delete the old object from the bucket
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

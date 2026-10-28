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
} from './data/seoDefaults';
import { GlobalSeoConfig, PageSeoConfig, SeoPageKey } from './types/seo';
import { R2MediaManifest } from './types/cafe';
import { DEFAULT_GALLERY, DEFAULT_SETTINGS } from './data/seedData';

const R2_MANIFEST_OBJECT_KEY = 'manifest/site-media.json';

export interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request | string | URL) => Promise<Response>;
  };
  R2_BUCKET?: {
    get: (key: string) => Promise<{ text: () => Promise<string> } | null>;
    put: (
      key: string,
      value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
      options?: {
        httpMetadata?: {
          contentType?: string;
          cacheControl?: string;
        };
      }
    ) => Promise<unknown>;
    delete: (key: string | string[]) => Promise<void>;
  };
  R2_PUBLIC_URL?: string;
  APP_URL?: string;
  R2_ACCOUNT_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_PUBLIC_URL?: string;
  S3_REGION?: string;
}

interface SeoRuntimeState {
  global: GlobalSeoConfig;
  pages: Record<SeoPageKey, PageSeoConfig>;
}

let workerSeoState: SeoRuntimeState = {
  global: { ...DEFAULT_GLOBAL_SEO },
  pages: { ...DEFAULT_PAGE_SEO },
};

function createDefaultWorkerR2Manifest(): R2MediaManifest {
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

let workerR2Manifest: R2MediaManifest = createDefaultWorkerR2Manifest();
let workerManifestLoaded = false;

function normalizeWorkerR2Manifest(raw: Partial<R2MediaManifest> | null | undefined): R2MediaManifest {
  const base = createDefaultWorkerR2Manifest();
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

function extractWorkerR2Key(url: string | undefined, publicUrl: string): string | null {
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

function getWorkerS3Client(env: WorkerEnv): { s3: S3Client; bucket: string; publicUrl: string } | null {
  const accountId = env.R2_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  const bucket = env.R2_BUCKET_NAME || env.S3_BUCKET_NAME || 'onelove-assets';
  const publicUrl = (
    env.R2_PUBLIC_URL ||
    env.S3_PUBLIC_URL ||
    'https://cdn.onelovecafesigiriya.com'
  ).replace(/\/$/, '');
  let endpoint = env.S3_ENDPOINT;
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  const s3 = new S3Client({
    region: env.S3_REGION || 'auto',
    ...(endpoint ? { endpoint } : {}),
    credentials: { accessKeyId, secretAccessKey },
  });
  return { s3, bucket, publicUrl };
}

async function readWorkerManifest(env: WorkerEnv, force = false): Promise<R2MediaManifest> {
  if (workerManifestLoaded && !force) return workerR2Manifest;
  try {
    if (env.R2_BUCKET) {
      const obj = await env.R2_BUCKET.get(R2_MANIFEST_OBJECT_KEY);
      if (obj) {
        const text = await obj.text();
        workerR2Manifest = normalizeWorkerR2Manifest(JSON.parse(text) as Partial<R2MediaManifest>);
        workerManifestLoaded = true;
        return workerR2Manifest;
      }
    } else {
      const s3Info = getWorkerS3Client(env);
      if (s3Info) {
        const resp = await s3Info.s3.send(
          new GetObjectCommand({
            Bucket: s3Info.bucket,
            Key: R2_MANIFEST_OBJECT_KEY,
          })
        );
        if (resp.Body) {
          const text = await resp.Body.transformToString('utf-8');
          workerR2Manifest = normalizeWorkerR2Manifest(JSON.parse(text) as Partial<R2MediaManifest>);
          workerManifestLoaded = true;
          return workerR2Manifest;
        }
      }
    }

    // Edge HTTP fallback to public R2 CDN domain (bypasses browser CORS and works even without Worker S3 secrets)
    const publicUrl = (
      env.R2_PUBLIC_URL ||
      env.S3_PUBLIC_URL ||
      'https://cdn.onelovecafesigiriya.com'
    ).replace(/\/$/, '');
    const cdnResp = await fetch(`${publicUrl}/${R2_MANIFEST_OBJECT_KEY}?t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
    });
    if (cdnResp.ok) {
      const text = await cdnResp.text();
      workerR2Manifest = normalizeWorkerR2Manifest(JSON.parse(text) as Partial<R2MediaManifest>);
      workerManifestLoaded = true;
      return workerR2Manifest;
    }
  } catch {
    // Fallback to in-memory state
  }
  return workerR2Manifest;
}

async function writeWorkerManifest(env: WorkerEnv, manifest: R2MediaManifest): Promise<string | null> {
  const normalized = normalizeWorkerR2Manifest(manifest);
  workerR2Manifest = normalized;
  workerManifestLoaded = true;
  const jsonStr = JSON.stringify(normalized, null, 2);
  const publicBase = (
    env.R2_PUBLIC_URL ||
    env.S3_PUBLIC_URL ||
    'https://cdn.onelovecafesigiriya.com'
  ).replace(/\/$/, '');

  if (env.R2_BUCKET) {
    await env.R2_BUCKET.put(R2_MANIFEST_OBJECT_KEY, jsonStr, {
      httpMetadata: {
        contentType: 'application/json; charset=utf-8',
        cacheControl: 'public, max-age=5, must-revalidate',
      },
    });
    return `${publicBase}/${R2_MANIFEST_OBJECT_KEY}`;
  }

  const s3Info = getWorkerS3Client(env);
  if (s3Info) {
    await s3Info.s3.send(
      new PutObjectCommand({
        Bucket: s3Info.bucket,
        Key: R2_MANIFEST_OBJECT_KEY,
        Body: new TextEncoder().encode(jsonStr),
        ContentType: 'application/json; charset=utf-8',
        CacheControl: 'public, max-age=5, must-revalidate',
      })
    );
    return `${s3Info.publicUrl}/${R2_MANIFEST_OBJECT_KEY}`;
  }
  return null;
}

async function deleteWorkerR2Object(env: WorkerEnv, keyOrUrl: string): Promise<string | null> {
  if (!keyOrUrl) return null;
  const publicBase = (
    env.R2_PUBLIC_URL ||
    env.S3_PUBLIC_URL ||
    'https://cdn.onelovecafesigiriya.com'
  ).replace(/\/$/, '');
  const extractedKey =
    keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')
      ? extractWorkerR2Key(keyOrUrl, publicBase)
      : keyOrUrl.replace(/^\/+/, '');
  if (!extractedKey || extractedKey === R2_MANIFEST_OBJECT_KEY) return null;

  if (env.R2_BUCKET) {
    await env.R2_BUCKET.delete(extractedKey);
    return extractedKey;
  }

  const s3Info = getWorkerS3Client(env);
  if (s3Info) {
    await s3Info.s3.send(
      new DeleteObjectCommand({
        Bucket: s3Info.bucket,
        Key: extractedKey,
      })
    );
    return extractedKey;
  }
  return null;
}

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
  honeypot: z.string().max(0).optional(),
});

const InquiryPayloadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().max(40).default(''),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(1000),
  honeypot: z.string().max(0).optional(),
});

function escapeHtmlAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectWorkerSeoIntoHtml(rawHtml: string, reqPath: string, hostHeader: string): string {
  const cleanPath = (reqPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const lower = cleanPath.toLowerCase();

  const { global: g, pages } = workerSeoState;
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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';

    // Handle internal relative alias /visit -> /contact
    if (pathname === '/visit' || pathname === '/visit/') {
      return Response.redirect(new URL('/contact' + url.search, url.origin).toString(), 301);
    }

    // API Endpoints
    if (pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        success: true,
        status: 'ok',
        service: 'onelove-cafe-sigiriya',
        timestamp: new Date().toISOString(),
      });
    }

    if (pathname === '/api/storage/status' && request.method === 'GET') {
      const hasR2Binding = Boolean(env.R2_BUCKET);
      const hasS3Creds = Boolean(
        (env.R2_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID) &&
          (env.R2_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY)
      );
      const isConfigured = hasR2Binding || hasS3Creds;
      const publicUrl = (
        env.R2_PUBLIC_URL ||
        env.S3_PUBLIC_URL ||
        (isConfigured ? 'https://cdn.onelovecafesigiriya.com' : '')
      ).replace(/\/$/, '') || null;
      const bucketName =
        env.R2_BUCKET_NAME ||
        env.S3_BUCKET_NAME ||
        (hasR2Binding ? 'onelove-assets' : null);

      return jsonResponse({
        ok: true,
        success: true,
        configured: isConfigured,
        provider: hasR2Binding
          ? 'cloudflare-r2'
          : hasS3Creds
          ? 'cloudflare-r2-s3'
          : 'inline',
        bucket: bucketName,
        publicUrl,
        manifestUrl: publicUrl ? `${publicUrl}/${R2_MANIFEST_OBJECT_KEY}` : null,
      });
    }

    if (pathname === '/api/storage/manifest' && request.method === 'GET') {
      const force = url.searchParams.get('refresh') === '1';
      const manifest = await readWorkerManifest(env, force);
      const hasR2Binding = Boolean(env.R2_BUCKET);
      const hasS3Creds = Boolean(
        (env.R2_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID) &&
          (env.R2_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY)
      );
      const isConfigured = hasR2Binding || hasS3Creds;
      const publicUrl = (
        env.R2_PUBLIC_URL ||
        env.S3_PUBLIC_URL ||
        'https://cdn.onelovecafesigiriya.com'
      ).replace(/\/$/, '');
      return jsonResponse({
        ok: true,
        success: true,
        configured: isConfigured,
        source: isConfigured ? 'cloudflare-r2' : 'memory',
        manifestUrl: isConfigured ? `${publicUrl}/${R2_MANIFEST_OBJECT_KEY}` : null,
        manifest,
      });
    }

    if (pathname === '/api/storage/manifest' && request.method === 'POST') {
      try {
        const current = await readWorkerManifest(env, false);
        const rawBody = ((await request.json()) || {}) as Record<string, unknown>;
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

        if (deleteUrls.length > 0) {
          for (const u of deleteUrls) {
            if (typeof u === 'string' && u.trim()) {
              await deleteWorkerR2Object(env, u).catch(() => {});
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

        const nextManifest: R2MediaManifest = normalizeWorkerR2Manifest({
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

        const manifestUrl = await writeWorkerManifest(env, nextManifest);
        return jsonResponse({
          ok: true,
          success: true,
          storage: manifestUrl ? 'r2' : 'local',
          manifestUrl,
          manifest: nextManifest,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            error: err instanceof Error ? err.message : 'Failed to update R2 manifest',
          },
          500
        );
      }
    }

    if (pathname === '/api/storage/delete' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { url?: string; urls?: string[]; key?: string };
        const targets: string[] = [];
        if (typeof body?.key === 'string' && body.key.trim()) targets.push(body.key.trim());
        if (typeof body?.url === 'string' && body.url.trim()) targets.push(body.url.trim());
        if (Array.isArray(body?.urls)) {
          body.urls.forEach((u) => {
            if (typeof u === 'string' && u.trim()) targets.push(u.trim());
          });
        }
        const deletedKeys: string[] = [];
        for (const target of targets) {
          const deleted = await deleteWorkerR2Object(env, target).catch(() => null);
          if (deleted) deletedKeys.push(deleted);
        }
        return jsonResponse({
          ok: true,
          success: true,
          deletedKeys,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            error: err instanceof Error ? err.message : 'Failed to delete object from R2',
          },
          500
        );
      }
    }

    if (pathname === '/api/upload' && request.method === 'POST') {
      if (!checkRateLimit(`upload_${clientIp}`, 30, 60_000)) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            error: 'Upload rate limit reached. Please wait a moment and try again.',
          },
          429
        );
      }

      try {
        const body = (await request.json()) as {
          dataUrl?: string;
          filename?: string;
          folder?: string;
          previousUrl?: string;
        };
        const { dataUrl, filename, folder, previousUrl } = body || {};

        if (!dataUrl || typeof dataUrl !== 'string') {
          return jsonResponse({ ok: false, success: false, error: 'dataUrl is required.' }, 400);
        }

        const hasR2Binding = Boolean(env.R2_BUCKET);
        const hasS3Creds = Boolean(
          (env.R2_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID) &&
            (env.R2_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY)
        );

        if (!hasR2Binding && !hasS3Creds) {
          return jsonResponse({
            ok: true,
            success: true,
            url: dataUrl,
            storage: 'inline',
            configured: false,
            message: 'R2 storage credentials not configured; stored as inline payload.',
          });
        }

        const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!matches || !matches[2]) {
          return jsonResponse({ ok: false, success: false, error: 'Invalid dataUrl.' }, 400);
        }

        const mimeType = matches[1];
        const rawBase64 = matches[2];
        const binaryString = atob(rawBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const ext = mimeType.replace('image/', '').replace('jpeg', 'jpg');
        const safeFolder = (folder || 'media').replace(/[^a-zA-Z0-9_-]/g, '');
        const rawName = (filename || 'image')
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .slice(0, 40);
        const key = `${safeFolder}/${Date.now()}-${rawName}.${ext}`;

        const publicBase = (
          env.R2_PUBLIC_URL ||
          env.S3_PUBLIC_URL ||
          'https://cdn.onelovecafesigiriya.com'
        ).replace(/\/$/, '');
        const publicUrl = `${publicBase}/${key}`;

        if (hasR2Binding && env.R2_BUCKET) {
          await env.R2_BUCKET.put(key, bytes, {
            httpMetadata: {
              contentType: mimeType,
              cacheControl: 'public, max-age=31536000, immutable',
            },
          });
        } else if (hasS3Creds) {
          const s3Info = getWorkerS3Client(env);
          if (s3Info) {
            await s3Info.s3.send(
              new PutObjectCommand({
                Bucket: s3Info.bucket,
                Key: key,
                Body: bytes,
                ContentType: mimeType,
                CacheControl: 'public, max-age=31536000, immutable',
              })
            );
          }
        }

        let deletedPreviousKey: string | null = null;
        if (typeof previousUrl === 'string' && previousUrl.trim()) {
          deletedPreviousKey = await deleteWorkerR2Object(env, previousUrl).catch(() => null);
        }

        return jsonResponse({
          ok: true,
          success: true,
          url: publicUrl,
          key,
          deletedPreviousKey,
          storage: 'r2',
          size: bytes.byteLength,
        });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            error: err instanceof Error ? err.message : 'R2 upload failed',
          },
          500
        );
      }
    }

    if (pathname === '/api/seo/config' && request.method === 'GET') {
      return jsonResponse({
        ok: true,
        success: true,
        global: workerSeoState.global,
        pages: workerSeoState.pages,
      });
    }

    if (pathname === '/api/seo/sync' && request.method === 'POST') {
      try {
        const body = (await request.json()) as Partial<SeoRuntimeState>;
        workerSeoState = {
          global: { ...workerSeoState.global, ...(body.global || {}) },
          pages: { ...workerSeoState.pages, ...(body.pages || {}) },
        };
        return jsonResponse({ ok: true, success: true });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            error: err instanceof Error ? err.message : 'Invalid SEO sync payload',
          },
          400
        );
      }
    }

    if (pathname === '/api/seo/favicon' && request.method === 'GET') {
      if (env.ASSETS) {
        return env.ASSETS.fetch(new Request(new URL('/favicon-96x96.png', request.url), request));
      }
    }

    if (pathname === '/api/reservations/validate' && request.method === 'POST') {
      if (!checkRateLimit(`res_${clientIp}`, 15, 60_000)) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            valid: false,
            error: 'Too many reservation attempts. Please wait a moment and try again.',
          },
          429
        );
      }
      try {
        const body = await request.json();
        const parsed = ReservationPayloadSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            {
              ok: false,
              success: false,
              valid: false,
              error: parsed.error.issues[0]?.message || 'Invalid reservation details.',
              issues: parsed.error.issues,
            },
            400
          );
        }

        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = 'OL-';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        return jsonResponse({
          ok: true,
          success: true,
          valid: true,
          referenceCode: code,
          sanitized: parsed.data,
          serverValidatedAt: new Date().toISOString(),
        });
      } catch {
        return jsonResponse(
          {
            ok: false,
            success: false,
            valid: false,
            error: 'Invalid reservation request payload.',
          },
          400
        );
      }
    }

    if (pathname === '/api/inquiries/validate' && request.method === 'POST') {
      if (!checkRateLimit(`inq_${clientIp}`, 10, 60_000)) {
        return jsonResponse(
          {
            ok: false,
            success: false,
            valid: false,
            error: 'Rate limit exceeded. Please wait a minute before sending another message.',
          },
          429
        );
      }
      try {
        const body = await request.json();
        const parsed = InquiryPayloadSchema.safeParse(body);
        if (!parsed.success) {
          return jsonResponse(
            {
              ok: false,
              success: false,
              valid: false,
              error: parsed.error.issues[0]?.message || 'Please check your inquiry fields.',
            },
            400
          );
        }

        return jsonResponse({
          ok: true,
          success: true,
          valid: true,
          sanitized: parsed.data,
        });
      } catch {
        return jsonResponse(
          {
            ok: false,
            success: false,
            valid: false,
            error: 'Invalid inquiry request payload.',
          },
          400
        );
      }
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ ok: true, success: true });
    }

    // Delegate static assets and SPA routes to Cloudflare Workers Static Assets binding
    if (env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        const contentType = assetResponse.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          const rawHtml = await assetResponse.text();
          const injected = injectWorkerSeoIntoHtml(
            rawHtml,
            pathname,
            request.headers.get('host') || url.host
          );
          const headers = new Headers(assetResponse.headers);
          headers.set('Content-Type', 'text/html; charset=utf-8');
          return new Response(injected, {
            status: assetResponse.status,
            headers,
          });
        }
        return assetResponse;
      }

      // SPA fallback for extensionless routes when ASSETS returns 404
      const indexUrl = new URL('/index.html', request.url);
      const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
      if (indexResponse.ok) {
        const rawHtml = await indexResponse.text();
        const injected = injectWorkerSeoIntoHtml(
          rawHtml,
          pathname,
          request.headers.get('host') || url.host
        );
        const headers = new Headers(indexResponse.headers);
        headers.set('Content-Type', 'text/html; charset=utf-8');
        return new Response(injected, {
          status: 200,
          headers,
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

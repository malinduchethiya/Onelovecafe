import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './data/seoDefaults';
import { PageSeoConfig, SeoPageKey } from './types/seo';

export interface WorkerR2Bucket {
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
}

export interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request | string | URL) => Promise<Response>;
  };
  R2_BUCKET?: WorkerR2Bucket;
  R2_PUBLIC_URL?: string;
  APP_URL?: string;
  R2_ACCOUNT_ID?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  R2_ENDPOINT?: string;
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_BUCKET_NAME?: string;
  S3_PUBLIC_URL?: string;
  S3_REGION?: string;
  AWS_ENDPOINT?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_S3_BUCKET?: string;
  AWS_S3_PUBLIC_URL?: string;
  AWS_REGION?: string;
  [key: string]: unknown;
}

function readEnvString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isR2BucketLike(value: unknown): value is WorkerR2Bucket {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.get === 'function' &&
    typeof candidate.put === 'function' &&
    typeof candidate.delete === 'function'
  );
}

function resolveWorkerR2Bucket(env: WorkerEnv): WorkerR2Bucket | null {
  if (isR2BucketLike(env.R2_BUCKET)) return env.R2_BUCKET;
  const preferredKeys = ['ONELOVE_ASSETS', 'ASSETS_BUCKET', 'MEDIA_BUCKET', 'BUCKET', 'R2'];
  for (const key of preferredKeys) {
    if (isR2BucketLike(env[key])) return env[key] as WorkerR2Bucket;
  }
  for (const [key, value] of Object.entries(env)) {
    if (key === 'ASSETS') continue;
    if (isR2BucketLike(value)) return value;
  }
  return null;
}

function getWorkerPublicUrl(env: WorkerEnv): string {
  return (
    readEnvString(env.R2_PUBLIC_URL) ||
    readEnvString(env.S3_PUBLIC_URL) ||
    readEnvString(env.AWS_S3_PUBLIC_URL) ||
    'https://cdn.onelovecafesigiriya.com'
  ).replace(/\/$/, '');
}

function extractWorkerR2Key(url: string | undefined, publicUrl: string): string | null {
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

function getWorkerS3Client(env: WorkerEnv): { s3: S3Client; bucket: string; publicUrl: string } | null {
  const accountId =
    readEnvString(env.R2_ACCOUNT_ID) ||
    readEnvString(env.CLOUDFLARE_ACCOUNT_ID) ||
    readEnvString(env.CF_ACCOUNT_ID);
  const accessKeyId =
    readEnvString(env.R2_ACCESS_KEY_ID) ||
    readEnvString(env.S3_ACCESS_KEY_ID) ||
    readEnvString(env.AWS_ACCESS_KEY_ID) ||
    readEnvString(env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const secretAccessKey =
    readEnvString(env.R2_SECRET_ACCESS_KEY) ||
    readEnvString(env.S3_SECRET_ACCESS_KEY) ||
    readEnvString(env.AWS_SECRET_ACCESS_KEY) ||
    readEnvString(env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  if (!accessKeyId || !secretAccessKey) return null;
  const bucket =
    readEnvString(env.R2_BUCKET_NAME) ||
    readEnvString(env.S3_BUCKET_NAME) ||
    readEnvString(env.AWS_S3_BUCKET) ||
    'onelove-assets';
  const publicUrl = getWorkerPublicUrl(env);
  let endpoint =
    readEnvString(env.R2_ENDPOINT) ||
    readEnvString(env.S3_ENDPOINT) ||
    readEnvString(env.AWS_ENDPOINT);
  if (!endpoint && accountId) {
    endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }
  if (!endpoint) return null;
  const s3 = new S3Client({
    region: readEnvString(env.S3_REGION) || readEnvString(env.AWS_REGION) || 'auto',
    endpoint,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId, secretAccessKey },
  });
  return { s3, bucket, publicUrl };
}

async function deleteWorkerR2Object(env: WorkerEnv, keyOrUrl: string): Promise<string | null> {
  if (!keyOrUrl) return null;
  const publicUrl = getWorkerPublicUrl(env);
  const key =
    keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')
      ? extractWorkerR2Key(keyOrUrl, publicUrl)
      : keyOrUrl.replace(/^\/+/, '');
  if (!key) return null;

  const r2Bucket = resolveWorkerR2Bucket(env);
  if (r2Bucket) {
    await r2Bucket.delete(key);
    return key;
  }

  const s3Info = getWorkerS3Client(env);
  if (s3Info) {
    await s3Info.s3.send(
      new DeleteObjectCommand({
        Bucket: s3Info.bucket,
        Key: key,
      })
    );
    return key;
  }

  return null;
}

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

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const host = (request.headers.get('host') || url.host || '').toLowerCase();

    if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (host.startsWith('www.onelovecafesigiriya.com') || host.startsWith('www.onelovecafe.lk')) {
      const canonicalDomain = (
        DEFAULT_GLOBAL_SEO.canonicalDomain || 'https://onelovecafesigiriya.com'
      ).replace(/\/+$/, '');
      return Response.redirect(`${canonicalDomain}${url.pathname}${url.search}`, 301);
    }

    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';

    if (pathname === '/robots.txt') {
      const baseUrl = (
        DEFAULT_GLOBAL_SEO.canonicalDomain ||
        env.APP_URL ||
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
      return new Response(lines.join('\n') + '\n', {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (pathname === '/sitemap.xml') {
      const baseUrl = (
        DEFAULT_GLOBAL_SEO.canonicalDomain ||
        env.APP_URL ||
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
      return new Response(xml, {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    if (pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        success: true,
        status: 'ok',
        service: 'onelove-cafe-sigiriya',
        runtime: 'cloudflare-workers',
        timestamp: new Date().toISOString(),
      });
    }

    if (pathname === '/api/storage/status') {
      const r2Bucket = resolveWorkerR2Bucket(env);
      const s3Info = r2Bucket ? null : getWorkerS3Client(env);
      const configured = Boolean(r2Bucket || s3Info);
      const publicUrl = getWorkerPublicUrl(env);
      return jsonResponse({
        ok: true,
        success: true,
        configured,
        provider: configured ? 'cloudflare-r2' : 'unconfigured',
        bucket: s3Info?.bucket || (r2Bucket ? 'onelove-assets' : null),
        publicUrl: configured ? publicUrl : null,
      });
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

        const r2Bucket = resolveWorkerR2Bucket(env);
        const s3Info = r2Bucket ? null : getWorkerS3Client(env);

        if (!r2Bucket && !s3Info) {
          return jsonResponse(
            {
              ok: false,
              success: false,
              configured: false,
              error:
                'Cloudflare R2 is not bound to this deployment. Bind R2_BUCKET (bucket: onelove-assets) or set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.',
            },
            503
          );
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

        const publicBase = getWorkerPublicUrl(env);
        const publicUrl = `${publicBase}/${key}`;

        if (r2Bucket) {
          await r2Bucket.put(key, bytes, {
            httpMetadata: {
              contentType: mimeType,
              cacheControl: 'public, max-age=31536000, immutable',
            },
          });
        } else if (s3Info) {
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

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ ok: false, success: false, error: 'API route not found' }, 404);
    }

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

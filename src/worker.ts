import { z } from 'zod';
import {
  DEFAULT_BRAND_FAVICON_PATH,
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './data/seoDefaults';
import { GlobalSeoConfig, PageSeoConfig, SeoPageKey } from './types/seo';

export interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request | string | URL) => Promise<Response>;
  };
  APP_URL?: string;
}

interface SeoRuntimeState {
  global: GlobalSeoConfig;
  pages: Record<SeoPageKey, PageSeoConfig>;
}

let workerSeoState: SeoRuntimeState = {
  global: { ...DEFAULT_GLOBAL_SEO },
  pages: { ...DEFAULT_PAGE_SEO },
};

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

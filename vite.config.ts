import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { PROJECT_FAVICON_ASSETS_BASE64 } from './src/data/projectFaviconAssets';
import {
  DEFAULT_GLOBAL_SEO,
  DEFAULT_PAGE_SEO,
  buildStructuredDataGraph,
} from './src/data/seoDefaults';
import { SeoPageKey } from './src/types/seo';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function escapeHtmlAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildRouteStaticHtml(baseHtml: string, pageKey: SeoPageKey | 'admin'): string {
  const domain = (DEFAULT_GLOBAL_SEO.canonicalDomain || 'https://onelovecafesigiriya.com').replace(
    /\/+$/,
    ''
  );

  if (pageKey === 'admin') {
    let adminHtml = baseHtml;
    adminHtml = adminHtml.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>SEO &amp; Hospitality Admin Console | OneLove Café Sigiriya</title>`
    );
    adminHtml = adminHtml.replace(
      /<meta\s+name="robots"[^>]*\/?>/i,
      `<meta name="robots" id="meta-robots" content="noindex, nofollow" />`
    );
    adminHtml = adminHtml.replace(
      /<link\s+rel="canonical"[^>]*\/?>/i,
      `<link rel="canonical" id="canonical-link" href="${domain}/admin" />`
    );
    return adminHtml;
  }

  const pageSeo = DEFAULT_PAGE_SEO[pageKey] || DEFAULT_PAGE_SEO.home;
  const canonicalPath = pageSeo.canonicalPath.startsWith('/')
    ? pageSeo.canonicalPath
    : `/${pageSeo.canonicalPath}`;
  const canonicalUrl = `${domain}${canonicalPath}`;
  const combinedKeywords = Array.from(
    new Set([
      pageSeo.primaryKeyword,
      ...(pageSeo.supportingKeywords || []),
      ...(DEFAULT_GLOBAL_SEO.alternateNames || []),
    ])
  )
    .filter(Boolean)
    .join(', ');

  let html = baseHtml;
  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtmlAttr(pageSeo.title)}</title>`
  );
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?\/>/i,
    `<meta name="description" content="${escapeHtmlAttr(pageSeo.metaDescription)}" />`
  );
  html = html.replace(
    /<meta\s+name="keywords"[\s\S]*?\/>/i,
    `<meta name="keywords" content="${escapeHtmlAttr(combinedKeywords)}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"[^>]*\/?>/i,
    `<link rel="canonical" id="canonical-link" href="${escapeHtmlAttr(canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"[\s\S]*?\/>/i,
    `<meta property="og:title" content="${escapeHtmlAttr(pageSeo.ogTitle || pageSeo.title)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/i,
    `<meta property="og:description" content="${escapeHtmlAttr(
      pageSeo.ogDescription || pageSeo.metaDescription
    )}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"[\s\S]*?\/>/i,
    `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"[\s\S]*?\/>/i,
    `<meta name="twitter:title" content="${escapeHtmlAttr(pageSeo.ogTitle || pageSeo.title)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
    `<meta name="twitter:description" content="${escapeHtmlAttr(
      pageSeo.ogDescription || pageSeo.metaDescription
    )}" />`
  );

  const jsonLdObj = buildStructuredDataGraph(DEFAULT_GLOBAL_SEO, pageSeo);
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

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cloudflare-spa-and-assets-guard',
        buildStart() {
          // Ensure every local favicon & logo binary in public/ matches PROJECT_FAVICON_ASSETS_BASE64 byte-for-byte
          for (const [relTarget, base64Data] of Object.entries(PROJECT_FAVICON_ASSETS_BASE64)) {
            const absTarget = path.resolve(__dirname, relTarget);
            const expectedBuf = Buffer.from(base64Data, 'base64');
            let needsWrite = !fs.existsSync(absTarget);
            if (!needsWrite) {
              try {
                const currentBuf = fs.readFileSync(absTarget);
                if (!currentBuf.equals(expectedBuf)) {
                  needsWrite = true;
                }
              } catch {
                needsWrite = true;
              }
            }
            if (needsWrite) {
              fs.mkdirSync(path.dirname(absTarget), { recursive: true });
              fs.writeFileSync(absTarget, expectedBuf);
            }
          }
        },
        closeBundle() {
          const distDir = path.resolve(__dirname, 'dist');
          if (!fs.existsSync(distDir)) return;

          // 1. Write exact binary favicon & logo files directly into dist/ for Cloudflare Pages
          for (const [relTarget, base64Data] of Object.entries(PROJECT_FAVICON_ASSETS_BASE64)) {
            const fileName = relTarget.replace(/^public\//, '');
            const distFile = path.resolve(distDir, fileName);
            fs.mkdirSync(path.dirname(distFile), { recursive: true });
            fs.writeFileSync(distFile, Buffer.from(base64Data, 'base64'));
          }

          // 2. Generate pre-rendered static HTML files per route in dist/ so Cloudflare Pages & Googlebot crawl every route with 200 OK, connected local favicons, and route-specific SEO metadata
          const indexPath = path.resolve(distDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            const baseHtml = fs.readFileSync(indexPath, 'utf-8');
            const homeHtml = buildRouteStaticHtml(baseHtml, 'home');
            fs.writeFileSync(indexPath, homeHtml, 'utf-8');
            fs.writeFileSync(path.resolve(distDir, '200.html'), homeHtml, 'utf-8');
            fs.writeFileSync(path.resolve(distDir, '404.html'), homeHtml, 'utf-8');

            const staticRoutes: Array<{ dir: string; key: SeoPageKey | 'admin' }> = [
              { dir: 'menu', key: 'menu' },
              { dir: 'reserve', key: 'reserve' },
              { dir: 'story', key: 'story' },
              { dir: 'gallery', key: 'gallery' },
              { dir: 'contact', key: 'contact' },
              { dir: 'events', key: 'events' },
              { dir: 'admin', key: 'admin' },
            ];

            for (const route of staticRoutes) {
              const routeDir = path.resolve(distDir, route.dir);
              fs.mkdirSync(routeDir, { recursive: true });
              const routeHtml = buildRouteStaticHtml(baseHtml, route.key);
              fs.writeFileSync(path.resolve(routeDir, 'index.html'), routeHtml, 'utf-8');
            }
          }

          // 3. If a build environment generates dist/wrangler.json, remove unsupported fields
          const generatedWranglerPath = path.resolve(distDir, 'wrangler.json');
          if (fs.existsSync(generatedWranglerPath)) {
            try {
              const rawConfig = JSON.parse(fs.readFileSync(generatedWranglerPath, 'utf-8')) as Record<
                string,
                unknown
              >;
              const unsupportedFields = ['exports', 'connect', 'agent_memory', 'k2'];
              for (const field of unsupportedFields) {
                delete rawConfig[field];
              }
              const assetsConfig =
                typeof rawConfig.assets === 'object' && rawConfig.assets !== null
                  ? (rawConfig.assets as Record<string, unknown>)
                  : {};
              rawConfig.assets = {
                ...assetsConfig,
                not_found_handling: 'single-page-application',
              };
              fs.writeFileSync(
                generatedWranglerPath,
                JSON.stringify(rawConfig, null, 2) + '\n',
                'utf-8'
              );
            } catch {
              // Ignore parse errors on non-standard files
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      chunkSizeWarningLimit: 1800,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

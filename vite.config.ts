import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';
import {
  DEFAULT_BRAND_FAVICON_PATH,
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

function staticRouteHtmlPlugin(): Plugin {
  return {
    name: 'onelove-static-route-html',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const indexFile = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexFile)) return;

      const baseHtml = fs.readFileSync(indexFile, 'utf-8');
      const g = DEFAULT_GLOBAL_SEO;
      const domain = (g.canonicalDomain || 'https://onelovecafesigiriya.com').replace(/\/+$/, '');

      const routeKeys: SeoPageKey[] = ['menu', 'reserve', 'story', 'gallery', 'contact', 'events'];

      for (const key of routeKeys) {
        const page = DEFAULT_PAGE_SEO[key];
        if (!page) continue;

        const cleanRoute = page.canonicalPath.replace(/^\/+|\/+$/g, '');
        if (!cleanRoute) continue;

        const canonicalUrl = `${domain}/${cleanRoute}`;
        const finalTitle = page.title || g.defaultTitle;
        const finalDesc = page.metaDescription || g.defaultDescription;
        const ogTitle = page.ogTitle || finalTitle;
        const ogDesc = page.ogDescription || finalDesc;
        const rawOgImg = page.ogImageUrl || g.defaultOgImageUrl || DEFAULT_BRAND_FAVICON_PATH;
        const ogImgUrl = rawOgImg.startsWith('http')
          ? rawOgImg
          : `${domain}${rawOgImg.startsWith('/') ? rawOgImg : `/${rawOgImg}`}`;

        let html = baseHtml;
        html = html.replace(
          /<title>[\s\S]*?<\/title>/i,
          `<title>${escapeHtmlAttr(finalTitle)}</title>`
        );
        html = html.replace(
          /<meta\s+name="description"[\s\S]*?\/>/i,
          `<meta name="description" content="${escapeHtmlAttr(finalDesc)}" />`
        );
        html = html.replace(
          /<link\s+rel="canonical"[^>]*\/?>/i,
          `<link rel="canonical" id="canonical-link" href="${escapeHtmlAttr(canonicalUrl)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:title"[\s\S]*?\/>/i,
          `<meta property="og:title" content="${escapeHtmlAttr(ogTitle)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:description"[\s\S]*?\/>/i,
          `<meta property="og:description" content="${escapeHtmlAttr(ogDesc)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:url"[\s\S]*?\/>/i,
          `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:image"[\s\S]*?\/>/i,
          `<meta property="og:image" content="${escapeHtmlAttr(ogImgUrl)}" />`
        );
        html = html.replace(
          /<meta\s+name="twitter:title"[\s\S]*?\/>/i,
          `<meta name="twitter:title" content="${escapeHtmlAttr(ogTitle)}" />`
        );
        html = html.replace(
          /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
          `<meta name="twitter:description" content="${escapeHtmlAttr(ogDesc)}" />`
        );
        html = html.replace(
          /<h1\s+id="static-seo-h1">[\s\S]*?<\/h1>/i,
          `<h1 id="static-seo-h1">${escapeHtmlAttr(finalTitle)}</h1>`
        );
        html = html.replace(
          /<p\s+id="static-seo-desc">[\s\S]*?<\/p>/i,
          `<p id="static-seo-desc">${escapeHtmlAttr(finalDesc)}</p>`
        );

        const jsonLdObj = buildStructuredDataGraph(g, page);
        html = html.replace(
          /<script\s+id="onelove-jsonld"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
          `<script id="onelove-jsonld" type="application/ld+json">\n${JSON.stringify(
            jsonLdObj,
            null,
            2
          )}\n    </script>`
        );

        const routeDir = path.join(distDir, cleanRoute);
        fs.mkdirSync(routeDir, { recursive: true });
        fs.writeFileSync(path.join(routeDir, 'index.html'), html, 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), staticRouteHtmlPlugin()],
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

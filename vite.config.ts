import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface StaticRouteMeta {
  route: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  breadcrumbName: string;
}

const STATIC_ROUTES: StaticRouteMeta[] = [
  {
    route: 'menu',
    title: 'OneLove Café Menu | Breakfast, Brunch, Coffee & Smoothies in Sigiriya',
    description:
      'Explore the OneLove Café Sigiriya menu featuring specialty Ceylon espresso, smoothie bowls, avocado toast, Sri Lankan rice & curry, pancakes, and fresh tropical juices.',
    ogTitle: 'OneLove Café Sigiriya Menu — Breakfast, Brunch, Coffee & Dining',
    ogDescription:
      'View dishes and prices in LKR & USD: highland pour-over coffee, smoothie bowls, hopper brunch plates, and wood-fired Sri Lankan cuisine.',
    breadcrumbName: 'OneLove Café Menu',
  },
  {
    route: 'reserve',
    title: 'Reserve a Table | OneLove Café Sigiriya',
    description:
      'Book your table online at OneLove Café in Sigiriya, Sri Lanka. Choose your preferred seating zone on our interactive floor plan for breakfast, brunch, lunch, or dinner.',
    ogTitle: 'Reserve a Table Online | OneLove Café Sigiriya Interactive Floor Plan',
    ogDescription:
      'Select your exact table across our Jungle Canopy Verandah, Laterite Stone Courtyard, Roastery Lounge, or Lotus Pavilion in Sigiriya.',
    breadcrumbName: 'Reserve a Table',
  },
  {
    route: 'story',
    title: 'Our Story | OneLove Café in Sigiriya, Sri Lanka',
    description:
      'Discover the story and tropical garden architecture of OneLove Café in Sigiriya—crafted from local laterite earth, reclaimed teak, and Sri Lankan hospitality.',
    ogTitle: 'Our Sigiriya Story & Sanctuary Architecture | OneLove Café',
    ogDescription:
      'Crafted from laterite earth, reclaimed teak, and monsoon light beneath Sigiriya Lion Rock.',
    breadcrumbName: 'Our Story',
  },
  {
    route: 'gallery',
    title: 'Gallery | OneLove Café Sigiriya Atmosphere, Food & Coffee',
    description:
      'Browse photos of OneLove Café in Sigiriya, Sri Lanka: tropical garden seating, specialty coffee, colorful smoothie bowls, brunch plates, and evening ambiance.',
    ogTitle: 'Photography Gallery | OneLove Café Sigiriya',
    ogDescription:
      'Visual archive of OneLove Café Sigiriya: open-air jungle architecture, specialty coffee rituals, brunch, and candlelit evenings.',
    breadcrumbName: 'Gallery',
  },
  {
    route: 'contact',
    title: 'Location, Opening Hours & Contact | OneLove Café Sigiriya',
    description:
      'Find OneLove Café near Sigiriya Lion Rock and Pidurangala in Sri Lanka. View opening hours, Google Maps directions, WhatsApp concierge contact, and visitor details.',
    ogTitle: 'Visit OneLove Café Sigiriya — Location, Hours & Directions',
    ogDescription:
      'Located on Lion Rock Sanctuary Road in Kimbissa, Sigiriya. Open daily 7:30 AM – 10:30 PM for sunrise coffee, brunch, and dinner.',
    breadcrumbName: 'Location, Opening Hours & Contact',
  },
  {
    route: 'events',
    title: 'Acoustic Nights & Coffee Cuppings | OneLove Café Sigiriya',
    description:
      'Join twilight acoustic music sessions, Highland Ceylon coffee cuppings, and seasonal dining experiences at OneLove Café in Sigiriya, Sri Lanka.',
    ogTitle: 'Experiences, Acoustic Nights & Coffee Cuppings | OneLove Café Sigiriya',
    ogDescription:
      'Weekly acoustic guitar evenings, single-estate Ceylon coffee tastings, and claypot supper clubs in Sigiriya.',
    breadcrumbName: 'Acoustic Nights & Coffee Cuppings',
  },
];

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
      const domain = 'https://onelovecafesigiriya.com';

      for (const item of STATIC_ROUTES) {
        const canonicalUrl = `${domain}/${item.route}`;
        let html = baseHtml;

        html = html.replace(
          /<title>[\s\S]*?<\/title>/i,
          `<title>${escapeHtmlAttr(item.title)}</title>`
        );
        html = html.replace(
          /<meta\s+name="description"[\s\S]*?\/>/i,
          `<meta name="description" content="${escapeHtmlAttr(item.description)}" />`
        );
        html = html.replace(
          /<link\s+rel="canonical"[^>]*\/?>/i,
          `<link rel="canonical" id="canonical-link" href="${escapeHtmlAttr(canonicalUrl)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:title"[\s\S]*?\/>/i,
          `<meta property="og:title" content="${escapeHtmlAttr(item.ogTitle)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:description"[\s\S]*?\/>/i,
          `<meta property="og:description" content="${escapeHtmlAttr(item.ogDescription)}" />`
        );
        html = html.replace(
          /<meta\s+property="og:url"[\s\S]*?\/>/i,
          `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`
        );
        html = html.replace(
          /<meta\s+name="twitter:title"[\s\S]*?\/>/i,
          `<meta name="twitter:title" content="${escapeHtmlAttr(item.ogTitle)}" />`
        );
        html = html.replace(
          /<meta\s+name="twitter:description"[\s\S]*?\/>/i,
          `<meta name="twitter:description" content="${escapeHtmlAttr(item.ogDescription)}" />`
        );
        html = html.replace(
          /<h1\s+id="static-seo-h1">[\s\S]*?<\/h1>/i,
          `<h1 id="static-seo-h1">${escapeHtmlAttr(item.title)}</h1>`
        );
        html = html.replace(
          /<p\s+id="static-seo-desc">[\s\S]*?<\/p>/i,
          `<p id="static-seo-desc">${escapeHtmlAttr(item.description)}</p>`
        );

        const routeDir = path.join(distDir, item.route);
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
    optimizeDeps: {
      entries: ['index.html'],
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
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

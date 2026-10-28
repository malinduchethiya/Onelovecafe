import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cloudflare-spa-and-assets-guard',
        buildStart() {
          const defaultIconSource = path.resolve(
            __dirname,
            'public/assets/aistudio/WhatsApp_Image_2026-10-26_at_07.57.02_10c5e84e.jpg'
          );
          if (fs.existsSync(defaultIconSource)) {
            const faviconTargets = [
              'public/favicon.ico',
              'public/favicon-48x48.png',
              'public/favicon-96x96.png',
              'public/favicon-192x192.png',
              'public/apple-touch-icon.png',
            ];
            for (const relTarget of faviconTargets) {
              const absTarget = path.resolve(__dirname, relTarget);
              if (!fs.existsSync(absTarget)) {
                fs.copyFileSync(defaultIconSource, absTarget);
              }
            }
          }
        },
        closeBundle() {
          const indexPath = path.resolve(__dirname, 'dist/index.html');
          const fallbackPath = path.resolve(__dirname, 'dist/200.html');
          if (fs.existsSync(indexPath)) {
            fs.copyFileSync(indexPath, fallbackPath);
          }

          // If a build environment generates dist/wrangler.json, remove unsupported fields
          const generatedWranglerPath = path.resolve(__dirname, 'dist/wrangler.json');
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


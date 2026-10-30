import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { PROJECT_FAVICON_ASSETS_BASE64 } from './src/data/projectFaviconAssets';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cloudflare-spa-and-assets-guard',
        buildStart() {
          for (const [relTarget, base64Data] of Object.entries(PROJECT_FAVICON_ASSETS_BASE64)) {
            const absTarget = path.resolve(__dirname, relTarget);
            const expectedBuf = Buffer.from(base64Data, 'base64');
            let needsWrite = !fs.existsSync(absTarget);
            if (!needsWrite) {
              try {
                const currentBuf = fs.readFileSync(absTarget);
                // Overwrite if file was corrupted (e.g. old 602-byte JPEG header 0xFF 0xD8) or size mismatch
                if (
                  currentBuf.length < 200 ||
                  (currentBuf[0] === 0xff && currentBuf[1] === 0xd8)
                ) {
                  needsWrite = true;
                }
              } catch {
                needsWrite = true;
              }
            }
            if (needsWrite) {
              fs.writeFileSync(absTarget, expectedBuf);
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


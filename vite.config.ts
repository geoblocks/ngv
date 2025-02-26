import {VitePWA} from 'vite-plugin-pwa';
import {defineConfig} from 'vite';
import {resolve} from 'path';

export default defineConfig({
  server: {
    strictPort: true,
    port: 1234,
    proxy: {
      '/api': {
        target: 'https://testext-oracle.hes.scot/apex/hes',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  build: {
    assetsDir: 'vassets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        permits: resolve(__dirname, 'src/apps/permits/index.html'),
        illumination: resolve(__dirname, 'src/apps/illumination/index.html'),
        survey: resolve(__dirname, 'src/apps/survey/index.html'),
        custom: resolve(__dirname, 'src/apps/custom/index.html'),
        // other: resolve(__dirname, "src/apps/ngv-something-else.html"),
      },
    },
  },
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      injectManifest: {
        swSrc: 'src/sw.ts',
        maximumFileSizeToCacheInBytes: 16e6, // 16mb (because of grid file)
        globPatterns: ['**/*.{js,css,html,svg,png,jpeg,jpg,ico,gsb,json,wasm}'],
      },
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      pwaAssets: {
        disabled: false,
        config: true,
      },
      manifest: {
        name: 'NGV3D',
        short_name: 'NGV3D',
        description: 'Next-Gen-3D-Viewer applications framework',
        theme_color: '#ffffff',
        display: 'minimal-ui',
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
        type: 'module',
      },
    }),
  ],
});

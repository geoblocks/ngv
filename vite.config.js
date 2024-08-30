import {resolve} from 'path';
import {defineConfig} from 'vite';

const __dirname = import.meta.dirname;

export default defineConfig({
  server: {
    strictPort: true,
    port: 1234,
  },

  build: {
    assetsDir: 'vassets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        permits: resolve(__dirname, 'src/apps/permits/index.html'),
        illumination: resolve(__dirname, 'src/apps/illumination/index.html'),
        // other: resolve(__dirname, "src/apps/ngv-something-else.html"),
      },
    },
  },
});

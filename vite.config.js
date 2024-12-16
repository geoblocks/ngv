import {resolve} from 'path';
import {defineConfig} from 'vite';
import {viteStaticCopy} from 'vite-plugin-static-copy';

const __dirname = import.meta.dirname;

export default defineConfig({
  server: {
    strictPort: true,
    port: 1234,
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@shoelace-style/shoelace/dist/assets/icons',
          dest: 'assets',
        },
      ],
    }),
  ],
  build: {
    assetsDir: 'vassets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        permits: resolve(__dirname, 'src/apps/permits/index.html'),
        illumination: resolve(__dirname, 'src/apps/illumination/index.html'),
        custom: resolve(__dirname, 'src/apps/custom/index.html'),
        // other: resolve(__dirname, "src/apps/ngv-something-else.html"),
      },
    },
  },
});

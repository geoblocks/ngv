import { resolve } from "path";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

export default defineConfig({
  server: {
    strictPort: true,
    port: 1234,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        buildings: resolve(__dirname, "src/apps/buildings/index.html"),
        // other: resolve(__dirname, "src/apps/ngv-something-else.html"),
      },
    },
  },
});

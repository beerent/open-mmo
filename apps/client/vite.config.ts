import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 4001,
    proxy: {
      "/socket.io": {
        target: "http://localhost:4000",
        ws: true,
      },
      "/api": {
        target: "http://localhost:4000",
      },
    },
  },
});

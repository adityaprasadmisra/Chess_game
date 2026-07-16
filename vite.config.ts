import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Same-origin in the browser, so the session cookie is first-party and
    // there is no CORS to configure.
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: false,
      },
      // ws:true forwards the HTTP upgrade; without it the socket handshake
      // never reaches the API and realtime silently never connects.
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        changeOrigin: false,
      },
    },
  },
})

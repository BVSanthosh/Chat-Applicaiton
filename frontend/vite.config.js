import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // `loadEnv` only reads .env files, so check the shell environment too — that
  // is where CI and one-off overrides put it.
  const devApiTarget =
    process.env.VITE_DEV_API_PROXY || env.VITE_DEV_API_PROXY || "http://127.0.0.1:8787";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Proxying keeps the dev frontend and the Worker on one origin, so the
      // session cookie behaves the same locally as it does in production
      // without needing SameSite=None just to develop.
      proxy: {
        "/api": {
          target: devApiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          // Splits the vendor bundle so a change to app code does not bust the
          // cache for React and friends on every deploy.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            vendor: ["axios", "zustand", "react-hot-toast", "lucide-react"],
          },
        },
      },
    },
  };
});

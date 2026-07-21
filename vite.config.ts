import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt': the UpdateBanner controls activation — never a surprise reload mid-visit.
      registerType: "prompt",
      includeAssets: ["icons/icon-180.png"],
      manifest: {
        name: "HouseSteady Field Assistant",
        short_name: "HouseSteady",
        description: "Offline-first home-inspection capture: the route card, interactive.",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // The entire app shell precaches; zero runtime network dependencies.
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});

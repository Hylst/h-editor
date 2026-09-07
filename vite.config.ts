/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { readFileSync } from "fs";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));

/** Couleur de thème unique, partagée par index.html et le manifeste. */
const THEME_COLOR = "#0f1419";

/**
 * Injecte la version réelle dans index.html (JSON-LD SEO). Le remplacement
 * textuel couvre `<script type="application/ld+json">`, là où `define` ne passe pas.
 */
const versionInjector = {
  name: "editorx-version-injector",
  transformIndexHtml(html: string): string {
    return html.split("__APP_VERSION__").join(pkg.version);
  },
};

export default defineConfig(() => ({
  base: "/heditor/",
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    // Évite la version « v1.0 » codée en dur dans la barre d'état.
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    versionInjector,
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // `og-image.png` en est volontairement absent : il ne sert qu'aux aperçus
      // de partage (récupérés par les robots depuis le réseau), jamais à l'application.
      includeAssets: ["favicon.ico", "icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "H Editor",
        short_name: "H Editor",
        description:
          "Éditeur de code 100 % local, né sur smartphone — Monaco Editor, 40+ langages, hors ligne.",
        theme_color: THEME_COLOR,
        background_color: THEME_COLOR,
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "browser"],
        start_url: "/heditor/",
        scope: "/heditor/",
        lang: "fr",
        orientation: "any",
        id: "/heditor/",
        icons: [
          { src: "favicon.ico", sizes: "32x32", type: "image/x-icon" },
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        // Ces raccourcis sont interprétés au démarrage par EditorLayout.
        shortcuts: [
          {
            name: "Nouveau fichier",
            short_name: "Nouveau",
            description: "Créer un nouveau fichier dans l'éditeur",
            url: "/heditor/?action=new-file",
            icons: [{ src: "icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Importer un fichier",
            short_name: "Importer",
            description: "Importer un fichier depuis le disque",
            url: "/heditor/?action=import",
            icons: [{ src: "icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Mode Zen",
            short_name: "Zen",
            description: "Ouvrir en mode plein écran sans distractions",
            url: "/heditor/?mode=zen",
            icons: [{ src: "icon-192.png", sizes: "192x192" }],
          },
        ],
        screenshots: [
          {
            src: "og-image.png",
            sizes: "1200x630",
            type: "image/png",
            form_factor: "wide",
            label: "EditorX — IDE professionnel dans votre navigateur",
          },
          {
            src: "og-image.png",
            sizes: "1200x630",
            type: "image/png",
            form_factor: "narrow",
            label: "EditorX sur mobile",
          },
        ],
      },
      workbox: {
        // Les polices auto-hébergées (woff2) font partie du précache : aucun réseau requis.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,ttf,woff2,webmanifest}"],
        // Le cœur de l'éditeur (Monaco + worker de base) est précaché : l'application
        // est réellement utilisable hors ligne. Les gros modules optionnels
        // (services de langage TS/CSS/HTML/JSON, Prettier, ZIP) sont mis en cache
        // à leur première utilisation, pour ne pas imposer 21 Mo au premier chargement.
        globIgnores: [
          // Services de langage et modules optionnels : mis en cache au premier usage
          "**/ts.worker-*.js",
          "**/css.worker-*.js",
          "**/html.worker-*.js",
          "**/json.worker-*.js",
          "**/prettier-*.js",
          "**/zip-*.js",
          // Illustrations de partage (og-image) : jamais utilisées par l'éditeur.
          "og-image.*",
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(ts|css|html|json)\.worker-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "monaco-language-workers",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/assets\/(prettier|zip)-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "editorx-optional-modules",
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Fallback offline si la navigation n'est pas dans le cache.
        // Nginx gère le routage SPA en ligne ; le SW fournit la page
        // offline.html uniquement quand le réseau est absent.
        // Chemin absolu préfixé par la base `/heditor/` (déploiement sous /heditor/).
        navigateFallback: "/heditor/offline.html",
        navigateFallbackDenylist: [/^\/api\//, /\.\w+$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("monaco-editor")) return "monaco";
          if (id.includes("prettier")) return "prettier";
          if (id.includes("jszip")) return "zip";
          if (id.includes("markdown-it") || id.includes("dompurify")) return "markdown";
          if (id.includes("react-dom") || id.includes("react-router") || id.includes("react/")) {
            return "react-vendor";
          }
          if (id.includes("@radix-ui") || id.includes("cmdk")) return "radix-vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
}));

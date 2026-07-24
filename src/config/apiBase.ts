/**
 * Where the serverless functions live. Same-origin `/api` in the browser/PWA (Netlify
 * redirects `/api/*` to the functions); the native shell (Stage 0) sets `VITE_API_BASE`
 * to the Netlify origin at build time, since its own origin is `capacitor://localhost`
 * and has no functions of its own.
 */
export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "/api").replace(/\/+$/, "");

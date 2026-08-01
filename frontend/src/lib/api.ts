// Backend base URL. Set VITE_API_URL in the environment for deployed builds;
// falls back to the local FastAPI dev server.
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:8000';

/** Public settings (VITE_*); they ship in the browser. */
export const config = {
  apiUrl: (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''),
};

export const configProblem = !config.apiUrl ? 'Copy .env.example to .env and fill VITE_API_URL.' : null;

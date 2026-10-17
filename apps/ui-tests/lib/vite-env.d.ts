// The apps' typed API files read Vite env at runtime; tests import their types only.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}

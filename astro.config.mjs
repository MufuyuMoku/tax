// @ts-check
import { defineConfig } from "astro/config";
import offline from "./src/lib/offline/integration.js";

// Project page on GitHub Pages: https://mufuyumoku.github.io/tax/
// `base` must stay in sync with the repository name.
export default defineConfig({
  site: "https://mufuyumoku.github.io",
  base: "/tax",
  trailingSlash: "always",
  build: { format: "directory" },
  // Offline page data, the check that offline pages equal the published ones, and sw.js (K-082).
  integrations: [offline()],
});

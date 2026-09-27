// @ts-check
import { defineConfig } from "astro/config";

// Project page on GitHub Pages: https://mufuyumoku.github.io/tax/
// `base` must stay in sync with the repository name.
export default defineConfig({
  site: "https://mufuyumoku.github.io",
  base: "/tax",
  trailingSlash: "always",
  build: { format: "directory" },
});

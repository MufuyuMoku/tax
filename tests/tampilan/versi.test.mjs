// The app version in package.json has its notes on "Apa yang baru" (K-084), so a release is never
// published without telling readers what changed.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("the current app version has release notes", () => {
  const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.match(version, /^\d+\.\d+\.\d+$/, "semver");
  const page = fs.readFileSync("src/pages/apa-yang-baru.astro", "utf8");
  assert.ok(page.includes(`version: "${version}"`), `catatan untuk v${version} tidak ada di apa-yang-baru.astro`);
});

// Text contrast meets WCAG AA (4.5:1) in the light and the dark theme (K-083). Reads the colour
// variables from src/styles/global.css, so a colour change that breaks contrast fails npm test.
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("src/styles/global.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Variables of every block whose selector matches, later blocks overriding earlier ones. */
function variables(selector) {
  const vars = {};
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1].trim() !== selector) continue;
    for (const [, name, value] of match[2].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) vars[name] = value;
  }
  return vars;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Text colour on background colour, as the stylesheets use them.
const PAIRS = [
  ["fg", "bg"],
  ["fg", "surface"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["bg", "accent"], // button text
  ["fg", "ok-bg"],
  ["fg", "alert-bg"],
  ["fg", "warn-bg"],
  ["muted", "warn-bg"],
  ["accent", "warn-bg"],
  ["private-line", "bg"],
  ["private-line", "private-bg"],
  ["fg", "private-bg"],
];

const light = variables(":root");
const dark = { ...light, ...variables(':root[data-theme="dark"]') };

for (const [name, theme] of [["terang", light], ["gelap", dark]]) {
  test(`text contrast is at least 4.5:1 in the ${name === "terang" ? "light" : "dark"} theme`, () => {
    const low = PAIRS.map(([text, back]) => [text, back, ratio(theme[text], theme[back])]).filter(([, , r]) => r < 4.5);
    assert.deepEqual(low.map(([t, b, r]) => `${t} di atas ${b}: ${r.toFixed(2)}`), []);
  });
}

test("the dark theme chosen under Aa equals the dark theme of the device", () => {
  const block = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/);
  const fromDevice = Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
  for (const [key, value] of Object.entries(fromDevice)) assert.equal(dark[key], value, key);
});

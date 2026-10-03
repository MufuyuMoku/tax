// A small Chrome DevTools Protocol client for the verification scripts. No packages: a local
// Chrome or Edge, and Node's own WebSocket.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function launch({ port = 9334 } = {}) {
  const binary = CANDIDATES.find((p) => fs.existsSync(p));
  if (!binary) throw new Error("Chrome atau Edge tidak ditemukan");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tax-cdp-"));
  const child = spawn(binary, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--no-first-run", "about:blank"], {
    stdio: "ignore",
  });
  let version = null;
  for (let i = 0; i < 50 && !version; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await sleep(200);
    }
  }
  if (!version) throw new Error("Chrome tidak menjawab");
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

  let nextId = 1;
  const waiting = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result);
    } else if (msg.method) {
      for (const listener of listeners) listener(msg);
    }
  });
  const send = (method, params = {}, sessionId = undefined) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  const close = () => {
    ws.close();
    child.kill();
  };
  return { send, on: (fn) => listeners.add(fn), close, profile };
}

// Builds the Saku Pajak Android app (Trusted Web Activity) with @bubblewrap/core (K-094).
// Lives outside the site repository, next to the generated Android project.
//
//   SAKU_KS_PASS=... node bangun.mjs <versionCode> <versionName>
//
// The keystore stays where it is (outside every repository); its password comes from the
// environment and is never written to disk by this script.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AndroidSdkTools, Config, ConsoleLog, JdkHelper, TwaGenerator, TwaManifest } from "@bubblewrap/core";

const [versionCode = "1", versionName = "1.2.1"] = process.argv.slice(2);
const JDK = "C:/Program Files/Android/Android Studio/jbr";
// Bubblewrap expects the old SDK layout (bin/ at the root); sdk/ holds junctions to the real SDK.
const SDK = path.resolve("sdk");
const KEYSTORE = "C:/Users/sorar/Documents/SakuPajak-kunci-tanda-tangan/sakupajak-upload.keystore";
const PROJECT = path.resolve("proyek");
const OUT = path.resolve("hasil");
const password = process.env.SAKU_KS_PASS;
if (!password) throw new Error("SAKU_KS_PASS belum disetel");

const log = new ConsoleLog("saku-pajak");
const config = new Config(JDK, SDK);
const jdk = new JdkHelper(process, config);
const sdk = await AndroidSdkTools.create(process, config, jdk, log);

const manifest = await TwaManifest.fromWebManifest("https://mufuyumoku.github.io/tax/manifest.webmanifest");
Object.assign(manifest, {
  packageId: "io.github.mufuyumoku.sakupajak",
  name: "Saku Pajak",
  launcherName: "Saku Pajak",
  host: "mufuyumoku.github.io",
  startUrl: "/tax/",
  fullScopeUrl: new URL("https://mufuyumoku.github.io/tax/"),
  themeColor: manifest.themeColor,
  navigationColor: manifest.themeColor,
  backgroundColor: manifest.backgroundColor,
  enableNotifications: false,
  // androidbrowserhelper 2.7 needs Android 7.0 (API 24) or newer.
  minSdkVersion: 24,
  fallbackType: "customtabs",
  appVersionCode: Number(versionCode),
  appVersionName: versionName,
  signingKey: { path: KEYSTORE, alias: "sakupajak" },
  // PNG icons: Bubblewrap cannot render the SVG one into launcher sizes.
  iconUrl: "https://mufuyumoku.github.io/tax/ikon-512.png",
  maskableIconUrl: "https://mufuyumoku.github.io/tax/ikon-maskable-512.png",
  generatorApp: "bubblewrap-core (Saku Pajak, K-094)",
});
console.log("ikon:", manifest.iconUrl, "maskable:", manifest.maskableIconUrl);

fs.rmSync(PROJECT, { recursive: true, force: true });
fs.mkdirSync(PROJECT, { recursive: true });
await manifest.saveToFile(path.join(PROJECT, "twa-manifest.json"));
await new TwaGenerator().createTwaProject(PROJECT, manifest, log);

// Node 24 no longer runs .bat files through execFile without a shell, which GradleWrapper does;
// run the wrapper through cmd with the same environment (JAVA_HOME, ANDROID_HOME) instead.
execFileSync("cmd", ["/c", path.join(PROJECT, "gradlew.bat"), "assembleRelease", "--stacktrace"], {
  cwd: PROJECT,
  env: { ...process.env, ...sdk.getEnv() },
  stdio: "inherit",
});

fs.mkdirSync(OUT, { recursive: true });
const unsigned = path.join(PROJECT, "app", "build", "outputs", "apk", "release", "app-release-unsigned.apk");
const aligned = path.join(OUT, "aligned.apk");
const signed = path.join(OUT, `SakuPajak-${versionName}.apk`);
await sdk.zipalign(unsigned, aligned);
// Sign with apksigner directly: the password is read from the environment (env:SAKU_KS_PASS), so it
// never appears on a command line or in a log. (Bubblewrap's helper puts it on the command line,
// and breaks on the space in "Program Files".)
const apksigner = path.join(SDK, "build-tools", "36.1.0", "lib", "apksigner.jar");
execFileSync(path.join(JDK, "bin", "java.exe"), ["-jar", apksigner, "sign", "--ks", KEYSTORE, "--ks-key-alias", "sakupajak",
  "--ks-pass", "env:SAKU_KS_PASS", "--key-pass", "env:SAKU_KS_PASS", "--out", signed, aligned], { stdio: "inherit" });
fs.rmSync(aligned);
console.log("APK:", signed);

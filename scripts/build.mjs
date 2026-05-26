import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import path from "node:path";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const distDir = path.join(rootDir, "dist");

await rm(distDir, { force: true, recursive: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "https://your-project.supabase.co";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "your-anon-key";

const configScript = `window.__BAOBEI_CONFIG__ = ${JSON.stringify(
  {
    supabaseUrl,
    supabaseAnonKey
  },
  null,
  2
)};\n`;

await writeFile(path.join(distDir, "app-config.js"), configScript, "utf8");

await build({
  bundle: true,
  entryPoints: [path.join(rootDir, "src/easy-cropper.jsx")],
  format: "iife",
  globalName: "__BaobeiEasyCropperBundle",
  logLevel: "silent",
  outfile: path.join(distDir, "js/easy-cropper.js")
});

const loginPage = await readFile(path.join(publicDir, "登录页-最终版.html"), "utf8");
await writeFile(path.join(distDir, "index.html"), loginPage, "utf8");

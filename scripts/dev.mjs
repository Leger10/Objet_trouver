// Démarre netlify dev (fonctions sur :8888) + Vite (front sur :5173)
// Vite proxifie /api -> localhost:8888 (voir vite.config.js)
// L'origine locale reste :5173 -> autorisée par les API Next.js (CORS)

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const run = (cmd, args, label) => {
  const child = spawn(cmd, args, {
    cwd: root,
    shell: isWin,
    env: process.env,
  });
  child.stdout.on("data", (d) =>
    process.stdout.write(`\x1b[36m[${label}]\x1b[0m ${d}`)
  );
  child.stderr.on("data", (d) =>
    process.stderr.write(`\x1b[31m[${label}]\x1b[0m ${d}`)
  );
  child.on("close", (code) => {
    console.log(`\x1b[31m[${label}] a quitté (code ${code}), arrêt...\x1b[0m`);
    cleanup();
  });
  return child;
};

let children = [];

const cleanup = () => {
  children.forEach((c) => {
    if (isWin) {
      spawn("taskkill", ["/pid", c.pid, "/T", "/F"], { stdio: "ignore" });
    } else {
      c.kill("SIGTERM");
    }
  });
  setTimeout(() => process.exit(0), 500);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

console.log("\x1b[32m== Démarrage RetrouveMoi Dev ==\x1b[0m");
console.log("   Front (Vite)     : \x1b[36mhttp://localhost:5173\x1b[0m");
console.log("   Fonctions Netlify : \x1b[36mhttp://localhost:8888/api/*\x1b[0m");
console.log("   /api/* sur 5173 est proxifié vers 8888.\n");

children.push(run("npx", ["netlify", "dev"], "netlify"));
children.push(
  run("npx", ["vite", "--host", "--port", "5173"], "vite")
);
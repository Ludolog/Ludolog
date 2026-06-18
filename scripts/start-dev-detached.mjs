import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const out = fs.openSync(path.join(cwd, ".next-dev.out.log"), "w");
const err = fs.openSync(path.join(cwd, ".next-dev.err.log"), "w");
const env = { ...process.env };

for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "path" && key !== "Path") {
    delete env[key];
  }
}

env.Path = process.env.Path || process.env.PATH || "";

const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1"], {
  cwd,
  detached: true,
  windowsHide: true,
  stdio: ["ignore", out, err],
  env
});

child.unref();
console.log(child.pid);

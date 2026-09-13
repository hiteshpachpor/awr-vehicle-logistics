import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export default function globalSetup() {
  const repoRoot = process.cwd();
  const envPath = path.join(repoRoot, ".env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  execSync("npm run db:seed -- --reset-db", {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });
}

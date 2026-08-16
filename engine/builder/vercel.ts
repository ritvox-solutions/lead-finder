import { spawn } from "node:child_process";
import { join } from "node:path";
import "dotenv/config";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key} in .env`);
  return v;
}

export interface DeployResult {
  projectName: string;
  url: string;
}

/**
 * Link + deploy districts a single Next.js site directory as its own Vercel
 * project, then push a production/preview deployment and return its URL.
 * Uses the Vercel CLI (npx @vercel/cli) with the token from VERCEL_TOKEN.
 */
export async function deployVercel(siteDir: string, projectName: string): Promise<DeployResult> {
  const token = env("VERCEL_TOKEN");
  const run = (args: string[]): Promise<{ code: number; out: string }> =>
    new Promise((resolve) => {
      const child = spawn("npx", ["--yes", "vercel@latest", ...args], {
        cwd: join(siteDir),
        env: { ...process.env, VERCEL_TOKEN: token },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (out += d));
      child.on("close", (code) => resolve({ code: code ?? 0, out }));
    });

  // Link project (creates a project in your account scoped to your username).
  const linkArgs = ["link", "--yes", "--project", projectName];
  if (process.env.VERCEL_SCOPE) linkArgs.push("--scope", process.env.VERCEL_SCOPE);
  const link = await run(linkArgs);
  if (link.code !== 0) {
    throw new Error(`Vercel link failed (${link.code}): ${link.out.slice(0, 400)}`);
  }

  // Production deploy.
  const deploy = await run(["deploy", "--prod", "--yes", "--token", token]);
  if (deploy.code !== 0) {
    throw new Error(`Vercel deploy failed (${deploy.code}): ${deploy.out.slice(0, 400)}`);
  }

  const urlLine = deploy.out.split("\n").find((l) => l.includes("https://"));
  let url = (urlLine?.match(/https:\/\/[^\s]+/) ?? [])[0];
  // Prefer a clean *.vercel.app URL over the dashboard/editor link.
  if (url && !url.includes(".vercel.app")) {
    const alias = deploy.out.match(/https:\/\/[\w-]+\.vercel\.app/);
    if (alias) url = alias[0];
  }
  if (!url) {
    throw new Error(`Could not find a URL in Vercel output:\n${deploy.out.slice(0, 500)}`);
  }
  return { projectName, url };
}
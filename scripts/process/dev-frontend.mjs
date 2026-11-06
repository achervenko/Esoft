import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  checkBackendHealth,
  waitForBackendHealth,
} from "../infrastructure/http/backend-health.mjs";
import { formatError } from "../infrastructure/security/redaction.mjs";
import { createNpmInvocation, npmArgs, runCommand } from "./run-parallel.mjs";

async function launchFrontend() {
  const npm = createNpmInvocation();
  return runCommand(npm.command, [
    ...npm.argsPrefix,
    ...npmArgs(["run", "dev", "--workspace", "frontend"]),
  ]);
}

export async function startDevFrontend(
  config,
  { timeoutMs = 90_000, runFrontend = launchFrontend } = {},
) {
  console.log("[frontend] Waiting for backend readiness...");
  const health = await waitForBackendHealth({
    checkHealth: () =>
      checkBackendHealth({
        config,
        url: config.backend.internalUrl ?? config.backend.url,
      }),
    timeoutMs,
  });
  if (!health.ok) {
    throw new Error(
      `Backend did not become ready within ${timeoutMs / 1000}s (${health.code}). Check the backend output above.`,
    );
  }
  console.log("[frontend] Backend is ready; starting Vite.");
  return runFrontend();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const require = createRequire(import.meta.url);
    const { config } = require("../config/config-core.cjs").loadConfig();
    const result = await startDevFrontend(config);
    process.exitCode = result.code ?? 1;
  } catch (error) {
    console.error(`[frontend] ${formatError(error)}`);
    process.exitCode = 1;
  }
}

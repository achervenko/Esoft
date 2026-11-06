import { createRequire } from "node:module";
const require = createRequire(import.meta.url),
  load = (p) => require("../../../backend/dist/src/" + p);
export function createReceiptTestAuth(prisma) {
  const { betterAuth } = require("better-auth");
  const { prismaAdapter } = require("better-auth/adapters/prisma");
  const { machineApiKeyPlugin, machineKeyDisabledPaths } = load(
    "auth/machine-api-key.plugin.js",
  );
  const { MachineApiKeysService } = load("auth/machine-api-keys.service.js");
  const machineAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: "receipt-test-only-auth-secret-32-characters",
    baseURL: "http://localhost:3000",
    disabledPaths: machineKeyDisabledPaths,
    plugins: [machineApiKeyPlugin()],
    logger: { disabled: true },
  });
  const machineKeys = new MachineApiKeysService(
    { api: machineAuth.api, instance: machineAuth },
    prisma,
  );
  return { machineAuth, machineKeys };
}

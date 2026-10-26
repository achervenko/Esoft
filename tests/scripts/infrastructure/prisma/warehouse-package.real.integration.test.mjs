import test from "node:test";
import { verifyWarehouseModuleInstallation } from "../../helpers/warehouse-module-installation.integration.mjs";
test(
  "warehouse installs independently, stays absent when disabled and can be installed later",
  {
    skip: process.env.ESOFT_MODULAR_MIGRATION_TEST !== "1",
    timeout: 240000,
  },
  verifyWarehouseModuleInstallation,
);

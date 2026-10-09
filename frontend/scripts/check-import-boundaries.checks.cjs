const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { boundaryViolations } = require("./check-import-boundaries.cjs");
const root = path.resolve("src");
const file = (name) => path.join(root, name);

test("rejects shared/page and cross-page imports, including dynamic imports and CSS", () => {
  assert.equal(
    boundaryViolations(
      file("shared/ui/Example.tsx"),
      'import { X } from "../../pages/Other/X";',
      root,
    ).length,
    1,
  );
  assert.equal(
    boundaryViolations(
      file("modules/feature/index.ts"),
      'export { X } from "../../pages/Other/X";',
      root,
    ).length,
    1,
  );
  assert.equal(
    boundaryViolations(
      file("pages/First/X.tsx"),
      'const load = () => import("../Second/X");',
      root,
    ).length,
    1,
  );
  assert.equal(
    boundaryViolations(
      file("pages/First/X.css"),
      '@import "../Second/X.css";',
      root,
    ).length,
    1,
  );
});
test("permits own page, reusable modules, page composition and test fixtures", () => {
  assert.equal(
    boundaryViolations(
      file("pages/First/X.tsx"),
      'import { X } from "./X";',
      root,
    ).length,
    0,
  );
  assert.equal(
    boundaryViolations(
      file("pages/First/X.tsx"),
      'import { X } from "../../modules/feature/X";',
      root,
    ).length,
    0,
  );
  assert.equal(
    boundaryViolations(
      file("layouts/Shell.tsx"),
      'const load = () => import("../pages/First/X");',
      root,
    ).length,
    0,
  );
  assert.equal(
    boundaryViolations(
      file("pages/First/X.test.tsx"),
      'import { fixture } from "../Second/fixture";',
      root,
    ).length,
    0,
  );
});

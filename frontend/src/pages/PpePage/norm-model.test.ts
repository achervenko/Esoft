import { expectTypeOf, it } from "vitest";
import type { PpeNorm } from "../../shared/api/ppe";
import type { NormFormState } from "./norm-model";

it("requires a norm for revision and edit, and excludes it from creation", () => {
  expectTypeOf<
    Extract<NormFormState, { mode: "edit" }>["norm"]
  >().toEqualTypeOf<PpeNorm>();
  expectTypeOf<
    Extract<NormFormState, { mode: "revision" }>["norm"]
  >().toEqualTypeOf<PpeNorm>();
  expectTypeOf<
    Extract<NormFormState, { mode: "create" }>["norm"]
  >().toEqualTypeOf<null>();
});

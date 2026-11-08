import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { hasCode } from "./warehouse-stock-test-context.mjs";

export async function verifyApiAccess(
  t,
  { request, closed, input, commands, keeper },
) {
  await t.test(
    "checks session permissions and denies direct service writes for a reader",
    async () => {
      await request("GET", "", 401, undefined, "anonymous");
      await request("GET", "", 403, undefined, "operator");
      await request("GET", "/orders/" + closed.id, 403, undefined, "operator");
      await request("GET", "", 200, undefined, "keeper");
      await request("GET", "/orders/" + closed.id, 403, undefined, "keeper");
      await request("POST", "", 403, input, "keeper");
      await request(
        "POST",
        "/" + randomUUID() + "/coverage/reduce",
        403,
        input,
        "keeper",
      );
      await request(
        "POST",
        "/" + randomUUID() + "/coverage/restore",
        403,
        input,
        "keeper",
      );
      await assert.rejects(
        commands.reserve(input, keeper.id),
        hasCode("FORBIDDEN", 403),
      );
    },
  );
}

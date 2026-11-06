import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { startDevFrontend } from "../../../scripts/process/dev-frontend.mjs";

async function backend(t, respond) {
  const server = createServer(respond);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    backend: {
      internalUrl: `http://127.0.0.1:${server.address().port}`,
      url: "http://unused.invalid",
    },
  };
}

test("frontend starts only after the backend changes from 503 to ready", async (t) => {
  let requests = 0,
    launched = false;
  const config = await backend(t, (request, response) => {
    assert.equal(request.url, "/api/health");
    assert.equal(launched, false);
    requests++;
    response.writeHead(requests === 1 ? 503 : 200, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ status: requests === 1 ? "error" : "ok" }));
  });
  const result = await startDevFrontend(config, {
    timeoutMs: 5000,
    runFrontend: () => {
      launched = true;
      return { code: 7 };
    },
  });
  assert.equal(requests, 2);
  assert.equal(launched, true);
  assert.equal(result.code, 7);
});

for (const status of [503, 500]) {
  test(`frontend never starts if backend stays HTTP ${status}`, async (t) => {
    const config = await backend(t, (_request, response) => {
      response.writeHead(status);
      response.end();
    });
    await assert.rejects(
      startDevFrontend(config, {
        timeoutMs: 0,
        runFrontend: () => assert.fail("Frontend must not start"),
      }),
      /Backend did not become ready/,
    );
  });
}

test("frontend never starts if backend refuses the connection", async (t) => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  await assert.rejects(
    startDevFrontend(
      { backend: { url: `http://127.0.0.1:${port}` } },
      {
        timeoutMs: 0,
        runFrontend: () => assert.fail("Frontend must not start"),
      },
    ),
    /BACKEND_HEALTH_UNREACHABLE/,
  );
});

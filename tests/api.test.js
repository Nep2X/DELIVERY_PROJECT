import test from "node:test";
import assert from "node:assert/strict";
import { apiJson } from "../spa/api.js";

const withFetch = async (impl, run) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
};

test("apiJson returns parsed body when ok", async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, json: async () => ({ ok: true, value: 3 }) }),
    async () => {
      const data = await apiJson("api/x.php");
      assert.equal(data.value, 3);
    }
  );
});

test("apiJson throws the server error and keeps field hints", async () => {
  await withFetch(
    async () => ({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, error: "Bad address", fields: ["street"] }),
    }),
    async () => {
      await assert.rejects(
        () => apiJson("api/x.php"),
        (error) => {
          assert.equal(error.message, "Bad address");
          assert.deepEqual(error.fields, ["street"]);
          return true;
        }
      );
    }
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { statusBadge, emptyState, errorState } from "../spa/ui.js";

test("statusBadge maps known statuses", () => {
  assert.match(statusBadge("Pending"), /pendingBadge/);
  assert.match(statusBadge("Delivered"), /deliveredBadge/);
  assert.match(statusBadge("Cancelled"), /cancelledBadge/);
});

test("statusBadge escapes unknown status", () => {
  assert.equal(
    statusBadge(`<b>x</b>`),
    `<span class="statusBadge">&lt;b&gt;x&lt;/b&gt;</span>`
  );
});

test("emptyState escapes title and message", () => {
  const html = emptyState({ title: "<x>", message: `a & b` });
  assert.match(html, /&lt;x&gt;/);
  assert.match(html, /a &amp; b/);
});

test("errorState escapes message", () => {
  assert.match(errorState("<bad>"), /&lt;bad&gt;/);
});

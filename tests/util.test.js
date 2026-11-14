import test from "node:test";
import assert from "node:assert/strict";
import { esc, fmtDate, fmtDateTime, todayKey, num, isOverdue } from "../spa/util.js";

test("esc escapes HTML special characters", () => {
  assert.equal(esc(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("fmtDate formats ISO date", () => {
  assert.equal(fmtDate("2026-11-14"), "Nov 14, 2026");
});

test("fmtDateTime formats SQL datetime", () => {
  assert.match(fmtDateTime("2026-11-14 08:30:00"), /Nov 14, 2026/);
});

test("fmtDateTime returns dash for empty", () => {
  assert.equal(fmtDateTime(""), "-");
});

test("todayKey returns YYYY-MM-DD", () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("num adds thousands separators", () => {
  assert.equal(num(1234), "1,234");
});

test("isOverdue only for active past deliveries", () => {
  assert.equal(isOverdue({ status: "Pending", del_date: "2000-01-01" }), true);
  assert.equal(isOverdue({ status: "Delivered", del_date: "2000-01-01" }), false);
  assert.equal(isOverdue({ status: "Pending", del_date: todayKey() }), false);
  assert.equal(isOverdue({ status: "Pending", del_date: "" }), false);
});

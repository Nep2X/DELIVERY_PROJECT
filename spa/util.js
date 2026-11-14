const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

export const fmtDate = (isoDate) => {
  const raw = String(isoDate ?? "").slice(0, 10);
  const parts = raw.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "-";
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const fmtDateTime = (sqlDateTime) => {
  const raw = String(sqlDateTime ?? "").trim();
  if (!raw) return "-";
  const date = new Date(raw.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

export const todayKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

export const num = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return parsed.toLocaleString("en-US");
};

const ACTIVE_STATUSES = new Set(["Pending", "Processing", "Out for Delivery"]);

export const isOverdue = (delivery) => {
  if (!delivery) return false;
  const status = String(delivery.status ?? "");
  const date = String(delivery.del_date ?? "").slice(0, 10);
  if (!ACTIVE_STATUSES.has(status) || !date) return false;
  return date < todayKey();
};

export function debounce(fn, wait = 150) {
  let timer = null;
  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

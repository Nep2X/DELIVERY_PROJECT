export const ROUTES = [
  { path: "dashboard", title: "Dashboard", group: "Overview", roles: ["Admin", "Employee"] },
  { path: "live-map", title: "Live Map", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "deliveries", title: "Deliveries", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "drivers", title: "Drivers", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "customers", title: "Customers", group: "Operations", roles: ["Admin", "Employee"] },
  { path: "reports", title: "Reports", group: "Insights", roles: ["Admin", "Employee"] },
  { path: "employees", title: "Employees", group: "Administration", roles: ["Admin"] },
  { path: "settings", title: "Settings", group: "Administration", roles: ["Admin", "Employee"] },
];

export function normalizePath(path) {
  const cleaned = String(path ?? "")
    .replace(/^#/, "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  return cleaned || "dashboard";
}

export function parseHash(hash) {
  const raw = String(hash ?? "").replace(/^#/, "");
  const queryIndex = raw.indexOf("?");
  const rawPath = queryIndex === -1 ? raw : raw.slice(0, queryIndex);
  const rawQuery = queryIndex === -1 ? "" : raw.slice(queryIndex + 1);
  return {
    path: normalizePath(rawPath),
    params: new URLSearchParams(rawQuery),
  };
}

export function buildHash(path, params = {}) {
  const base = `#/${normalizePath(path)}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function routeFor(path) {
  const wanted = normalizePath(path);
  return ROUTES.find((route) => route.path === wanted) || null;
}

export function navigate(path, options = {}) {
  if (typeof window === "undefined") return;
  const hash = path.startsWith("#") ? path : buildHash(path, options.params);
  if (options.replace) {
    window.location.replace(hash);
  } else {
    window.location.hash = hash;
  }
}

export function startRouter(onRoute) {
  if (typeof window === "undefined") return () => {};
  const emit = () => {
    const { path, params } = parseHash(window.location.hash);
    onRoute(routeFor(path), params, path);
  };
  // Kapag binalik ng browser ang page mula sa bfcache (hal. Back galing rider.html),
  // i-render ulit ang kasalukuyang route para fresh ang data at buhay ang view.
  const onPageShow = (event) => {
    if (event.persisted) emit();
  };
  window.addEventListener("hashchange", emit);
  window.addEventListener("pageshow", onPageShow);
  emit();
  return () => {
    window.removeEventListener("hashchange", emit);
    window.removeEventListener("pageshow", onPageShow);
  };
}

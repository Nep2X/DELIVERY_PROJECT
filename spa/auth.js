import { apiJson } from "./api.js";
import { routeFor } from "./router.js";

export const STAFF_ROLES = ["Admin", "Employee"];

const RIDER_ROLES = ["Rider", "Driver"];

export const roleHome = (role) => (STAFF_ROLES.includes(role) ? "dashboard" : "rider");

export const canAccess = (role, path) => {
  if (!STAFF_ROLES.includes(role)) return false;
  const route = routeFor(path);
  if (!route) return false;
  return route.roles.includes(role);
};

export const loginUrlFor = (hash) => {
  const target = String(hash ?? "").trim();
  if (!target.startsWith("#/")) return "login.html";
  return `login.html?next=${encodeURIComponent(target)}`;
};

export async function bootAuth() {
  let user;
  try {
    const data = await apiJson("api/auth.php?action=me");
    user = data.user || data;
  } catch {
    window.location.replace(loginUrlFor(window.location.hash));
    throw new Error("Not authenticated");
  }
  if (!user || !user.role) {
    window.location.replace(loginUrlFor(window.location.hash));
    throw new Error("Not authenticated");
  }
  if (!STAFF_ROLES.includes(user.role)) {
    window.location.replace("rider.html");
    throw new Error("Staff access only");
  }
  window.currentUser = user;
  document.dispatchEvent(new CustomEvent("userready", { detail: user }));
  return user;
}

export async function logout() {
  try {
    await apiJson("api/auth.php?action=logout", { method: "POST" });
  } catch {
    /* session already gone; still leave the app */
  }
  window.location.replace("login.html");
}

export function install401Handler() {
  if (window.__spa401Installed) return;
  window.__spa401Installed = true;
  const original = window.fetch;
  window.fetch = async function patchedFetch(...args) {
    const res = await original.apply(this, args);
    if (res.status === 401) {
      window.location.replace(loginUrlFor(window.location.hash));
    }
    return res;
  };
}

export const isRiderRole = (role) => RIDER_ROLES.includes(role);

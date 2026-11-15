import { bootAuth, canAccess, install401Handler, logout } from "./auth.js";
import { buildHash, navigate, startRouter } from "./router.js";
import { createShell } from "./shell.js";
import { confirmBox, initModalTrap, toast } from "./ui.js";
import { esc } from "./util.js";

const VIEWS = {
  dashboard: () => import("./views/dashboard.js"),
  deliveries: () => import("./views/deliveries.js"),
  "live-map": () => import("./views/live-map.js"),
  drivers: () => import("./views/drivers.js"),
  customers: () => import("./views/customers.js"),
  employees: () => import("./views/employees.js"),
  reports: () => import("./views/reports.js"),
  settings: () => import("./views/settings.js"),
};

const TITLES = {
  dashboard: "Dashboard",
  "live-map": "Live Map",
  deliveries: "Deliveries",
  drivers: "Drivers",
  customers: "Customers",
  employees: "Employees",
  reports: "Reports",
  settings: "Settings",
};

const placeholderFor = (title) => ({
  route: "",
  title,
  group: "",
  async mount(root) {
    root.innerHTML = `
      <div class="spaViewHead">
        <div>
          <h1 tabindex="-1">${esc(title)}</h1>
          <p>This view is still being rebuilt inside the new shell.</p>
        </div>
      </div>
      <div class="spaEmpty">
        <strong>${esc(title)}</strong>
        <p>Coming in a later step of the migration.</p>
      </div>`;
    return () => {};
  },
});

async function boot() {
  const app = document.getElementById("app");
  if (!app) return;

  install401Handler();

  const user = await bootAuth().catch(() => null);
  if (!user) return;

  const shell = createShell(app, { user, navigate });
  const viewRoot = app.querySelector("#viewRoot");
  const mainContent = app.querySelector("#mainContent");
  const stopModalTrap = initModalTrap();

  // Ang skip link ay hindi route; iwasan ang hashchange papuntang dashboard.
  const skipLink = document.querySelector(".skipLink");
  const onSkipClick = (event) => {
    event.preventDefault();
    mainContent.scrollIntoView({ block: "start" });
    mainContent.focus({ preventScroll: true });
  };
  if (skipLink) skipLink.addEventListener("click", onSkipClick);

  let disposeView = () => {};
  let controller = null;
  let runToken = 0;

  const focusHeading = () => {
    const heading = viewRoot.querySelector("h1");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    } else {
      viewRoot.setAttribute("tabindex", "-1");
      viewRoot.focus({ preventScroll: true });
    }
  };

  const renderFailure = (message) => {
    viewRoot.innerHTML = `
      <div class="spaViewHead">
        <div>
          <h1 tabindex="-1">Something went wrong</h1>
          <p>The page could not be loaded.</p>
        </div>
      </div>
      <div class="spaError" role="alert">
        <strong>Error</strong>
        <p>${esc(message)}</p>
      </div>`;
    focusHeading();
  };

  const loadView = async (path) => {
    const loader = VIEWS[path];
    if (!loader) return null;
    try {
      const mod = await loader();
      return mod.default || mod;
    } catch (error) {
      console.error(`[spa] failed to load view "${path}"`, error);
      return null;
    }
  };

  const makeCtx = (path, params) => {
    const cleanups = [];
    const ctx = {
      user,
      route: { path, params },
      navigate,
      setQuery(nextParams, options = {}) {
        const merged = new URLSearchParams(params);
        for (const [key, value] of Object.entries(nextParams || {})) {
          if (value === null || value === undefined || value === "") merged.delete(key);
          else merged.set(key, String(value));
        }
        const record = {};
        merged.forEach((value, key) => {
          record[key] = value;
        });
        navigate(buildHash(path, record), options);
      },
      setSearch: shell.setSearch,
      setCta: shell.setCta,
      toast,
      confirm: confirmBox,
      signal: controller.signal,
      onCleanup(fn) {
        if (typeof fn === "function") cleanups.push(fn);
      },
    };
    ctx.runCleanups = () => {
      while (cleanups.length) {
        const fn = cleanups.pop();
        try {
          fn();
        } catch (error) {
          console.error("[spa] cleanup failed", error);
        }
      }
    };
    return ctx;
  };

  const showRoute = async (route, params, rawPath) => {
    if (!route) {
      navigate("dashboard", { replace: true });
      return;
    }
    if (!canAccess(user.role, route.path)) {
      navigate("dashboard", { replace: true });
      return;
    }

    const token = ++runToken;

    try {
      disposeView();
    } catch (error) {
      console.error("[spa] view cleanup failed", error);
    }
    disposeView = () => {};

    if (controller) controller.abort();
    controller = new AbortController();

    shell.closeAccountMenu();
    shell.setSearch(null);
    shell.setCta(null);
    shell.setActive(route.path);
    shell.setPageMeta(route);

    const module = (await loadView(route.path)) || placeholderFor(TITLES[rawPath] || route.title);
    if (token !== runToken) return;

    viewRoot.innerHTML = "";
    const ctx = makeCtx(route.path, params);

    try {
      const result = await module.mount(viewRoot, ctx);
      if (token !== runToken) {
        if (typeof result === "function") result();
        ctx.runCleanups();
        return;
      }
      disposeView = () => {
        if (typeof result === "function") result();
        ctx.runCleanups();
      };
      focusHeading();
    } catch (error) {
      console.error("[spa] view mount failed", error);
      if (token === runToken) renderFailure(error?.message || "Unknown error");
    }
  };

  const stopRouter = startRouter((route, params, rawPath) => {
    showRoute(route, params, rawPath).catch((error) => {
      console.error("[spa] routing failed", error);
      renderFailure(error?.message || "Unknown error");
    });
  });

  const confirmLogout = async () => {
    if (await confirmBox("Log out of Delivery Project?")) logout();
  };

  app.querySelector("#sidebarLogoutButton")?.addEventListener("click", confirmLogout);
  app.querySelector("#liveLogoutButton")?.addEventListener("click", confirmLogout);
  app.querySelector("#liveProfileButton")?.addEventListener("click", () => {
    shell.closeAccountMenu();
    navigate("settings");
  });

  window.addEventListener(
    "pagehide",
    () => {
      stopRouter();
      if (controller) controller.abort();
      try {
        disposeView();
      } catch {
        /* page is going away */
      }
      shell.destroy();
      stopModalTrap();
      if (skipLink) skipLink.removeEventListener("click", onSkipClick);
    },
    { once: true }
  );
}

boot().catch((error) => {
  console.error("[spa] boot failed", error);
});

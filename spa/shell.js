import { esc } from "./util.js";

const ICONS = {
  dashboard: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/>',
  "live-map": '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  deliveries: '<path d="M3 6.5 12 3l9 3.5v11L12 21l-9-3.5Z"/><path d="M3 6.5 12 10l9-3.5"/><path d="M12 10v11"/>',
  drivers: '<circle cx="12" cy="8" r="3.4"/><path d="M5 21c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
  customers: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6"/><path d="M16 5.5a3 3 0 0 1 0 5.6"/><path d="M17.5 14.6c2.3.6 4 2.4 4 5.4"/>',
  reports: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5"/><rect x="13" y="8" width="3" height="9"/>',
  employees: '<circle cx="12" cy="7.5" r="3.2"/><path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6"/><path d="M18.5 4.8 19 7l2.2.5-2.2.6-.5 2.2-.6-2.2-2.2-.6L18 7Z"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.5 12H2.1M21.9 12h-2.4M6.7 6.7 5 5M19 19l-1.7-1.7M17.3 6.7 19 5M5 19l1.7-1.7"/>',
  rider: '<circle cx="6" cy="17" r="2.6"/><circle cx="18" cy="17" r="2.6"/><path d="m6 17 4-7h5l3 7"/><path d="M9 6.5h3.5"/>',
};

const GROUPS = [
  {
    name: "Overview",
    items: [{ path: "dashboard", label: "Dashboard", id: "dashboardButton", icon: "dashboard" }],
  },
  {
    name: "Operations",
    items: [
      { path: "live-map", label: "Live Map", id: "mapButton", icon: "live-map" },
      { path: "deliveries", label: "Deliveries", id: "deliveriesButton", icon: "deliveries" },
      { path: "drivers", label: "Drivers", id: "driversButton", icon: "drivers" },
      { path: "customers", label: "Customers", id: "customersButton", icon: "customers" },
      {
        href: "rider.html",
        label: "Rider report",
        id: "riderButton",
        icon: "rider",
        adminOnly: true,
        outbound: true,
      },
    ],
  },
  {
    name: "Insights",
    items: [{ path: "reports", label: "Reports", id: "reportsButton", icon: "reports" }],
  },
  {
    name: "Administration",
    items: [
      {
        path: "employees",
        label: "Employees",
        id: "employeeButton",
        icon: "employees",
        adminOnly: true,
      },
      { path: "settings", label: "Settings", id: "settingsButton", icon: "settings" },
    ],
  },
];

const icon = (name) =>
  `<svg class="spaNavIcon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

function navItem(item, isAdmin) {
  if (item.adminOnly && !isAdmin) return "";
  const cls = `spaNavLink${item.outbound ? " isOutbound" : ""}`;
  const inner = `${icon(item.icon)}<span class="spaNavLabel">${esc(item.label)}</span>`;
  if (item.href) {
    return `<a class="${cls}" id="${item.id}" href="${item.href}">${inner}</a>`;
  }
  return `<a class="${cls}" id="${item.id}" href="#/${item.path}" data-route="${item.path}">${inner}</a>`;
}

export function createShell(root, { user, navigate }) {
  const isAdmin = user?.role === "Admin";
  const displayName = user?.name || user?.username || "Signed in";
  const roleLabel = user?.role || "";

  const groupsHtml = GROUPS.map(
    (group) => `
      <div class="spaGroup" data-group="${esc(group.name)}">
        <div class="spaGroupHead">${esc(group.name)}</div>
        <nav class="spaGroupBody" aria-label="${esc(group.name)}">
          ${group.items.map((item) => navItem(item, isAdmin)).join("")}
        </nav>
      </div>`
  ).join("");

  root.innerHTML = `
    <div class="spaApp">
      <button type="button" class="spaBackdrop" data-close-drawer aria-label="Close menu"></button>

      <aside class="spaSidebar" id="spaSidebar" aria-label="Main navigation">
        <div class="spaBrand">
          <img src="assets/company-logo.svg" alt="">
          <div class="spaBrandText">
            <strong>Delivery Project</strong>
            <span>Ops console</span>
          </div>
          <button type="button" class="spaCollapseBtn" id="spaCollapseBtn" aria-label="Collapse navigation" aria-expanded="true">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>
          </button>
        </div>

        ${groupsHtml}

        <div class="spaSidebarFoot">
          <div class="spaUserCard">
            <span class="spaAvatar" aria-hidden="true">${esc(initials(displayName))}</span>
            <span class="spaUserMeta">
              <strong title="${esc(displayName)}">${esc(displayName)}</strong>
              <span>${esc(roleLabel)}</span>
            </span>
          </div>
          <button type="button" class="spaLogoutBtn" id="sidebarLogoutButton">Logout</button>
        </div>
      </aside>

      <div class="spaColumn">
        <header class="spaTopbar">
          <button type="button" class="spaMenuBtn" id="spaMenuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="spaSidebar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>

          <div class="spaBreadcrumb">
            <span id="spaCrumbGroup">Overview</span>
            <span aria-hidden="true">/</span>
            <strong id="spaCrumbTitle">Dashboard</strong>
          </div>

          <div class="spaTopbarSpacer"></div>

          <div class="spaSearch" id="spaSearch" hidden>
            <input type="search" id="spaSearchInput" placeholder="Search" aria-label="Search">
          </div>

          <button type="button" class="spaCta" id="spaCta" hidden></button>

          <div class="spaAccount" id="spaAccount">
            <button type="button" class="spaAccountBtn" id="liveAccountButton" aria-haspopup="true" aria-expanded="false" aria-controls="liveAccountMenu" aria-label="Account menu">
              <img src="assets/company-logo.svg" alt="">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="spaAccountMenu" id="liveAccountMenu" role="menu" hidden>
              <div class="spaMenuWho">${esc(displayName)} · ${esc(roleLabel)}</div>
              <button type="button" role="menuitem" id="liveProfileButton">Profile</button>
              <button type="button" role="menuitem" id="liveLogoutButton">Logout</button>
            </div>
          </div>
        </header>

        <main class="spaMain" id="mainContent" tabindex="-1">
          <div class="spaView" id="viewRoot"></div>
        </main>
      </div>
    </div>`;

  const app = root.querySelector(".spaApp");
  const sidebar = root.querySelector("#spaSidebar");
  const menuBtn = root.querySelector("#spaMenuBtn");
  const collapseBtn = root.querySelector("#spaCollapseBtn");
  const backdrop = root.querySelector("[data-close-drawer]");
  const accountBtn = root.querySelector("#liveAccountButton");
  const accountMenu = root.querySelector("#liveAccountMenu");
  const searchWrap = root.querySelector("#spaSearch");
  const searchInput = root.querySelector("#spaSearchInput");
  const cta = root.querySelector("#spaCta");
  const crumbGroup = root.querySelector("#spaCrumbGroup");
  const crumbTitle = root.querySelector("#spaCrumbTitle");

  let searchHandler = null;
  let ctaHandler = null;

  const savedCollapse = (() => {
    try {
      return localStorage.getItem("spaSidebar");
    } catch {
      return null;
    }
  })();
  if (savedCollapse === "collapsed" && window.matchMedia("(min-width: 880px)").matches) {
    app.classList.add("spaSidebarCollapsed");
    collapseBtn.setAttribute("aria-expanded", "false");
  }

  const closeAccountMenu = (restoreFocus = false) => {
    accountMenu.hidden = true;
    accountBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) accountBtn.focus();
  };

  const openAccountMenu = () => {
    accountMenu.hidden = false;
    accountBtn.setAttribute("aria-expanded", "true");
    accountMenu.querySelector('[role="menuitem"]')?.focus();
  };

  const onAccountClick = () => {
    if (accountMenu.hidden) openAccountMenu();
    else closeAccountMenu(true);
  };

  const openDrawer = () => {
    app.classList.add("spaDrawerOpen");
    menuBtn.setAttribute("aria-expanded", "true");
    sidebar.querySelector("a, button")?.focus();
  };

  const closeDrawer = (restoreFocus = false) => {
    if (!app.classList.contains("spaDrawerOpen")) return;
    app.classList.remove("spaDrawerOpen");
    menuBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) menuBtn.focus();
  };

  const onMenuClick = () => {
    if (app.classList.contains("spaDrawerOpen")) closeDrawer(true);
    else openDrawer();
  };

  const onCollapseClick = () => {
    const collapsed = app.classList.toggle("spaSidebarCollapsed");
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    collapseBtn.setAttribute("aria-label", collapsed ? "Expand navigation" : "Collapse navigation");
    try {
      localStorage.setItem("spaSidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      /* storage blocked: collapse still works for this session */
    }
  };

  const onDocumentClick = (event) => {
    if (!root.querySelector("#spaAccount")?.contains(event.target)) {
      if (!accountMenu.hidden) closeAccountMenu();
    }
  };

  const onKeydown = (event) => {
    if (event.key !== "Escape") return;
    if (!accountMenu.hidden) {
      event.preventDefault();
      closeAccountMenu(true);
      return;
    }
    if (app.classList.contains("spaDrawerOpen")) {
      event.preventDefault();
      closeDrawer(true);
    }
  };

  const onSearchInput = () => {
    if (searchHandler) searchHandler(searchInput.value);
  };

  const onCtaClick = () => {
    if (ctaHandler) ctaHandler();
  };

  const onNavClick = (event) => {
    const link = event.target.closest("[data-route]");
    if (!link) return;
    event.preventDefault();
    closeDrawer();
    navigate(link.dataset.route);
  };

  const onBackdropClick = () => closeDrawer(true);

  menuBtn.addEventListener("click", onMenuClick);
  collapseBtn.addEventListener("click", onCollapseClick);
  backdrop.addEventListener("click", onBackdropClick);
  sidebar.addEventListener("click", onNavClick);
  accountBtn.addEventListener("click", onAccountClick);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeydown);
  searchInput.addEventListener("input", onSearchInput);
  cta.addEventListener("click", onCtaClick);

  const setPageMeta = (route) => {
    crumbGroup.textContent = route?.group || "Overview";
    crumbTitle.textContent = route?.title || "Dashboard";
    document.title = `${route?.title || "Dashboard"} | Delivery Project`;
  };

  const setActive = (path) => {
    root.querySelectorAll("[data-route]").forEach((link) => {
      const active = link.dataset.route === path;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  const setSearch = (config) => {
    if (!config) {
      searchWrap.hidden = true;
      searchHandler = null;
      searchInput.value = "";
      return;
    }
    searchWrap.hidden = false;
    searchInput.placeholder = config.placeholder || "Search";
    if (config.label) searchInput.setAttribute("aria-label", config.label);
    if (typeof config.value === "string" && searchInput.value !== config.value) {
      searchInput.value = config.value;
    }
    searchHandler = typeof config.onInput === "function" ? config.onInput : null;
  };

  const setCta = (config) => {
    if (!config) {
      cta.hidden = true;
      ctaHandler = null;
      cta.textContent = "";
      return;
    }
    cta.hidden = false;
    cta.textContent = config.label || "";
    ctaHandler = typeof config.onClick === "function" ? config.onClick : null;
  };

  const destroy = () => {
    menuBtn.removeEventListener("click", onMenuClick);
    collapseBtn.removeEventListener("click", onCollapseClick);
    backdrop.removeEventListener("click", onBackdropClick);
    sidebar.removeEventListener("click", onNavClick);
    accountBtn.removeEventListener("click", onAccountClick);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeydown);
    searchInput.removeEventListener("input", onSearchInput);
    cta.removeEventListener("click", onCtaClick);
  };

  return {
    element: app,
    user,
    setSearch,
    setCta,
    setPageMeta,
    setActive,
    openDrawer,
    closeDrawer,
    closeAccountMenu,
    destroy,
  };
}

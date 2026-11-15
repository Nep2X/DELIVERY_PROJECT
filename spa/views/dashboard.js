import { esc, fmtDate, isOverdue, num } from "../util.js";
import { statusBadge } from "../ui.js";

const DASH_API = "api/dashboard.php";

const STATUS_ROWS = [
  { key: "Pending", cls: "pending" },
  { key: "Processing", cls: "processing" },
  { key: "Out for Delivery", cls: "out" },
  { key: "Delivered", cls: "delivered" },
  { key: "Cancelled", cls: "cancelled" },
];

const greetingFor = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const firstName = (user) =>
  String(user?.full_name || user?.name || user?.username || "")
    .trim()
    .split(/\s+/)[0] || "there";

const formatClock = (date) =>
  date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });

const countUp = (el, value, suffix = "") => {
  if (!el) return;
  const target = Number(value) || 0;
  const reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !target) {
    el.textContent = num(target) + suffix;
    return;
  }
  let frame = 0;
  const started = performance.now();
  const duration = 550;
  const tick = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = num(Math.round(target * eased)) + suffix;
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
};

const template = (ctx) => `
  <div class="spaViewHead">
    <div>
      <div class="spaHeadMeta">
        <span id="dashDate">—</span>
        <span aria-hidden="true">·</span>
        <span id="dashUpdated" role="status">Loading…</span>
      </div>
      <h1 id="dashGreeting" tabindex="-1">${esc(greetingFor())}, ${esc(firstName(ctx.user))}</h1>
      <p>Here’s what’s happening with your deliveries today.</p>
    </div>
    <div class="spaHeadMeta">
      <button type="button" class="btnOutline" id="openMapBtn">Live Map</button>
    </div>
  </div>

  <div class="kpiGrid">

    <article class="kpiCard kpiTotal" style="--kpi-accent: var(--primary)">
      <div class="kpiTop">
        <span class="kpiIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 7.5 12 3l8 4.5-8 4.5-8-4.5Z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5 12 21l8-4.5"/></svg>
        </span>
        <span class="kpiLabel">Total deliveries</span>
      </div>
      <div class="kpiValue" id="kpiTotal">0</div>
      <div class="kpiFoot"><span id="kpiTotalFoot">All records</span></div>
    </article>

    <article class="kpiCard kpiActive" style="--kpi-accent: var(--blue)">
      <div class="kpiTop">
        <span class="kpiIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M2.5 7.5h11v8h-11z"/><path d="M13.5 10h3.8l3.2 3.1v2.4h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg>
        </span>
        <span class="kpiLabel">Active now</span>
      </div>
      <div class="kpiValue" id="kpiActive">0</div>
      <div class="kpiFoot"><span id="kpiActiveFoot">Pending, processing, and on the road</span></div>
    </article>

    <article class="kpiCard kpiRate" style="--kpi-accent: var(--green)">
      <div class="kpiTop">
        <span class="kpiIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.8-5"/></svg>
        </span>
        <span class="kpiLabel">Success rate</span>
      </div>
      <div class="kpiValue" id="kpiRate">0%</div>
      <div class="kpiFoot"><span id="kpiRateFoot">No deliveries yet</span></div>
    </article>

    <article class="kpiCard kpiOverdue" style="--kpi-accent: var(--destructive)">
      <div class="kpiTop">
        <span class="kpiIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.8v4.7l3 1.8"/><path d="M12 17.1v.1"/></svg>
        </span>
        <span class="kpiLabel">Overdue</span>
      </div>
      <div class="kpiValue" id="kpiOverdue">0</div>
      <div class="kpiFoot"><span id="kpiOverdueFoot">All active deliveries on time</span></div>
    </article>

  </div>

  <div class="dashGrid">

    <section class="dashPanel activityPanel">
      <header class="dashPanelHead">
        <div>
          <h2>Delivery activity</h2>
          <p id="chartSub">Last 7 days</p>
        </div>
        <select id="periodSelect" aria-label="Chart period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="year">This year</option>
        </select>
      </header>

      <div class="activityMeta">
        <strong id="chartTotal">0</strong>
        <span>deliveries in this period</span>
      </div>

      <div class="activityChart" aria-hidden="true">
        <div class="activityBars" id="chartBars"></div>
        <div class="activityDays" id="chartDays"></div>
      </div>
      <table class="srOnly" id="chartTable">
        <caption>Delivery activity</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Deliveries</th>
          </tr>
        </thead>
        <tbody id="chartTableBody"></tbody>
      </table>
    </section>

    <section class="dashPanel breakdownPanel">
      <header class="dashPanelHead">
        <div>
          <h2>Status breakdown</h2>
          <p>Where every delivery stands</p>
        </div>
      </header>

      <div class="breakdownList" id="statusList"></div>
      <div class="breakdownFoot" id="driverFoot">—</div>
    </section>

  </div>

  <section class="dashPanel recentPanel">
    <header class="dashPanelHead">
      <div>
        <h2>Recent deliveries</h2>
        <p>Latest transactions in the system</p>
      </div>
      <button type="button" class="btnOutline" id="viewAllBtn">View all</button>
    </header>

    <div class="tableWrapper">
      <table class="recentDeliveryTable">
        <thead>
          <tr>
            <th scope="col">Delivery</th>
            <th scope="col">Customer</th>
            <th scope="col">Driver</th>
            <th scope="col">Date</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody id="recentRows">
          <tr><td colspan="5" class="emptyRow">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  </section>`;

export default {
  route: "dashboard",
  title: "Dashboard",
  group: "Overview",

  async mount(root, ctx) {
    root.innerHTML = template(ctx);

    const $ = (id) => root.querySelector(`#${id}`);
    let hasRendered = false;
    let stopCountUp = null;
    let timer = null;
    let alive = true;

    const dateLabel = $("dashDate");
    if (dateLabel) {
      dateLabel.textContent = new Intl.DateTimeFormat("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date());
    }

    const setValue = (el, value, suffix = "") => {
      if (!el) return;
      if (hasRendered) {
        el.textContent = num(value) + suffix;
        return;
      }
      if (stopCountUp) stopCountUp();
      stopCountUp = countUp(el, value, suffix);
    };

    const renderStats = (data) => {
      const counts = data.counts || {};
      const total = Number(data.total) || 0;
      const delivered = Number(counts["Delivered"]) || 0;
      const rate = total ? Math.round((delivered / total) * 100) : 0;
      const overdue = Number(data.overdue) || 0;

      setValue($("kpiTotal"), total);
      setValue($("kpiActive"), data.active);
      setValue($("kpiRate"), rate, "%");
      setValue($("kpiOverdue"), overdue);
      hasRendered = true;

      const totalFoot = $("kpiTotalFoot");
      if (totalFoot) totalFoot.textContent = `${num(data.today_total)} scheduled today`;

      const activeFoot = $("kpiActiveFoot");
      if (activeFoot) {
        const out = Number(counts["Out for Delivery"]) || 0;
        activeFoot.textContent = `${num(out)} out for delivery right now`;
      }

      const rateFoot = $("kpiRateFoot");
      if (rateFoot) {
        const cancelled = Number(counts["Cancelled"]) || 0;
        rateFoot.textContent = total
          ? `${num(delivered)} of ${num(total)} completed${cancelled ? ` · ${num(cancelled)} cancelled` : ""}`
          : "No deliveries yet";
      }

      const overdueCard = $("kpiOverdue")?.closest(".kpiCard");
      if (overdueCard) {
        overdueCard.classList.toggle("is-overdue", overdue > 0);
        overdueCard.classList.toggle("is-clear", overdue === 0);
      }

      const overdueFoot = $("kpiOverdueFoot");
      if (overdueFoot) {
        overdueFoot.textContent =
          overdue > 0 ? "Needs attention today" : "All active deliveries on time";
      }
    };

    const renderBreakdown = (data) => {
      const counts = data.counts || {};
      const total = Number(data.total) || 0;
      const list = $("statusList");
      if (!list) return;

      list.innerHTML = STATUS_ROWS.map(({ key, cls }) => {
        const count = Number(counts[key]) || 0;
        const percent = total ? Math.round((count / total) * 100) : 0;
        return `<div class="breakdownRow">
          <div class="breakdownTop">
            <span class="breakdownName"><i class="statusDot ${cls}"></i>${esc(key)}</span>
            <strong>${num(count)}</strong>
          </div>
          <div class="breakdownTrack">
            <span class="breakdownFill ${cls}" style="width:${percent}%"></span>
          </div>
          <span class="breakdownPct">${percent}%</span>
        </div>`;
      }).join("");

      const drivers = data.drivers || {};
      const onRoute = Number(drivers["On Route"]) || 0;
      const available = Number(drivers["Available"]) || 0;
      const driverFoot = $("driverFoot");
      if (driverFoot) {
        driverFoot.textContent =
          `${num(onRoute)} ${onRoute === 1 ? "driver" : "drivers"} on route · ` +
          `${num(available)} available`;
      }
    };

    const renderRecent = (list) => {
      const tbody = $("recentRows");
      if (!tbody) return;

      if (!Array.isArray(list) || !list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="emptyRow">No deliveries yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = list
        .map((delivery) => {
          const late = isOverdue(delivery);
          return `<tr>
            <td><b>${esc(delivery.del_number)}</b></td>
            <td>${esc(delivery.customer_name)}</td>
            <td>${esc(delivery.driver_name) || '<span class="mutedText">Unassigned</span>'}</td>
            <td>${esc(fmtDate(delivery.del_date)) || "—"}${
              late ? ' <span class="statusBadge lateBadge">Overdue</span>' : ""
            }</td>
            <td>${statusBadge(delivery.status)}</td>
          </tr>`;
        })
        .join("");
    };

    const renderChart = (chart) => {
      const bars = $("chartBars");
      const days = $("chartDays");
      if (!bars || !days) return;

      const labels = chart.labels || [];
      const values = chart.values || [];
      const max = Math.max(...values, 1);
      const sum = values.reduce((a, b) => a + Number(b || 0), 0);

      const chartTotal = $("chartTotal");
      if (chartTotal) chartTotal.textContent = num(sum);

      bars.innerHTML = values
        .map((value, index) => {
          const count = Number(value) || 0;
          const height = count === 0 ? 2 : Math.max(6, Math.round((count / max) * 100));
          return `<div class="activityCol" title="${esc(labels[index])}: ${num(count)}">
            <span class="activityValue">${count ? num(count) : ""}</span>
            <span class="activityBar" style="height:${height}%"></span>
          </div>`;
        })
        .join("");

      days.innerHTML = labels.map((label) => `<span>${esc(label)}</span>`).join("");

      const tableBody = $("chartTableBody");
      if (tableBody) {
        tableBody.innerHTML = labels
          .map(
            (label, index) =>
              `<tr><th scope="row">${esc(label)}</th><td>${num(values[index] || 0)}</td></tr>`
          )
          .join("");
      }
    };

    const setSub = (period) => {
      const sub = $("chartSub");
      if (!sub) return;
      sub.textContent =
        period === "30" ? "Last 30 days" : period === "year" ? "This year" : "Last 7 days";
    };

    const load = async () => {
      const period = $("periodSelect")?.value || "7";
      try {
        const res = await fetch(`${DASH_API}?period=${encodeURIComponent(period)}`, {
          signal: ctx.signal,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Invalid response");
        if (!alive) return;

        renderStats(data);
        renderBreakdown(data);
        renderRecent(data.recent);
        renderChart(data.chart || {});
        setSub(period);

        const updated = $("dashUpdated");
        if (updated) updated.textContent = `Updated ${formatClock(new Date())}`;
      } catch (error) {
        if (!alive || error?.name === "AbortError") return;
        console.error(error);
        const tbody = $("recentRows");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="5" class="emptyRow">${esc(
            error.message || "Failed to load"
          )}</td></tr>`;
        }
        const updated = $("dashUpdated");
        if (updated) updated.textContent = "Update failed";
      }
    };

    $("periodSelect")?.addEventListener("change", () => {
      hasRendered = false;
      load();
    });

    $("openMapBtn")?.addEventListener("click", () => ctx.navigate("live-map"));
    $("viewAllBtn")?.addEventListener("click", () => ctx.navigate("deliveries"));

    ctx.setCta({
      label: "+ New Delivery",
      onClick: () => ctx.navigate("deliveries", { params: { new: 1 } }),
    });

    const onVisible = () => {
      if (!document.hidden) load();
    };

    timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    document.addEventListener("visibilitychange", onVisible);

    load();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (stopCountUp) stopCountUp();
    };
  },
};

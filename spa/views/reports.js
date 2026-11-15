import { apiJson } from "../api.js";
import { buildHash } from "../router.js";
import { esc, fmtDateTime, num } from "../util.js";

const REP_API = "api/reports.php";

const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));

const fmtMonth = (ym) => {
  const [year, month] = String(ym ?? "").split("-").map(Number);
  if (!year || !month) return String(ym ?? "—");
  return new Date(year, month - 1, 1, 12, 0, 0).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const fmtDay = (value) => {
  if (!isDateKey(value)) return String(value ?? "—");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0).toLocaleDateString("en-PH", {
    dateStyle: "medium",
  });
};

const periodLabel = ({ from, to } = {}) => {
  if (from && to) return `${fmtDay(from)} – ${fmtDay(to)}`;
  if (from) return `From ${fmtDay(from)}`;
  if (to) return `Up to ${fmtDay(to)}`;
  return "All dates";
};

const rateLabel = (delivered, total) =>
  total ? `${Math.round((Number(delivered) / Number(total)) * 100)}%` : "0%";

const proofCell = (path, label) =>
  path
    ? `<a href="${esc(path)}" class="proofLink" data-photo-link data-photo-alt="Proof for ${esc(
        label
      )}"><img class="proofThumb" loading="lazy" src="${esc(path)}" alt="Proof for ${esc(
        label
      )}"></a>`
    : `<span class="proofMissing">No photo</span>`;

const template = () => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Reports</h1>
      <p>Delivery summaries by rider, driver, customer, and month.</p>
      <div class="spaHeadMeta"><span id="repMeta" role="status">Loading…</span></div>
    </div>
    <div class="spaReportControls">
      <span class="spaReportRange">
        <label for="repFrom">From
          <input type="date" id="repFrom" aria-label="From date">
        </label>
        <label for="repTo">To
          <input type="date" id="repTo" aria-label="To date">
        </label>
      </span>
      <button type="button" class="btnPrimary" id="repGenerate">Generate</button>
      <button type="button" class="btnOutline" id="repReset">Reset</button>
      <button type="button" class="btnOutline" id="repExport">Export CSV</button>
      <button type="button" class="btnOutline" id="repPrint">Print</button>
    </div>
  </div>

  <div class="repMessage" id="repMessage" role="alert" hidden></div>

  <div class="printInfo">
    <h1>Delivery Report</h1>
    <p id="printPeriod"></p>
    <p id="printRider"></p>
    <p id="printedOn"></p>
  </div>

  <div class="kpiGrid">
    <article class="kpiCard" style="--kpi-accent: var(--primary)">
      <div class="kpiTop"><span class="kpiLabel">Total deliveries</span></div>
      <div class="kpiValue" id="repTotal">—</div>
      <div class="kpiFoot"><span>In selected period</span></div>
    </article>

    <article class="kpiCard" style="--kpi-accent: var(--green)">
      <div class="kpiTop"><span class="kpiLabel">Delivered</span></div>
      <div class="kpiValue" id="repDelivered">—</div>
      <div class="kpiFoot"><span>Successfully completed</span></div>
    </article>

    <article class="kpiCard" style="--kpi-accent: var(--destructive)">
      <div class="kpiTop"><span class="kpiLabel">Cancelled</span></div>
      <div class="kpiValue" id="repCancelled">—</div>
      <div class="kpiFoot"><span>Cancelled deliveries</span></div>
    </article>

    <article class="kpiCard" style="--kpi-accent: var(--blue)">
      <div class="kpiTop"><span class="kpiLabel">Delivered rate</span></div>
      <div class="kpiValue" id="repRate">—</div>
      <div class="kpiFoot"><span>Delivered ÷ total</span></div>
    </article>
  </div>

  <div class="spaWorkspace spaReportWorkspace">
    <div class="spaWorkspaceMain">
      <div class="spaReportGrid" id="repGrid">
        <section class="panel tablePanel spaReportCard spaReportWide" aria-labelledby="riderReportTitle">
          <div class="spaPanelHead">
            <strong id="riderReportTitle">Rider report</strong>
            <div class="spaReportPanelTools">
              <span class="mutedText" id="riderMeta">—</span>
              <label class="spaInlineLabel" for="riderFilter">Rider</label>
              <select id="riderFilter" aria-label="Filter rider report by rider">
                <option value="">All riders</option>
              </select>
            </div>
          </div>
          <div class="tableWrapper">
            <table class="dataTable" data-mobile-cards>
              <thead>
                <tr>
                  <th scope="col">Delivery no.</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Delivery date</th>
                  <th scope="col">Delivered at</th>
                  <th scope="col">Rider</th>
                  <th scope="col">Proof photo</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody id="riderRows">
                <tr><td colspan="7" class="spaTableEmpty">Loading report…</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel tablePanel spaReportCard" aria-labelledby="byDriverTitle">
          <div class="spaPanelHead">
            <strong id="byDriverTitle">By driver</strong>
            <span class="mutedText" id="driverMeta">—</span>
          </div>
          <div class="tableWrapper">
            <table class="dataTable" data-mobile-cards>
              <thead>
                <tr>
                  <th scope="col">Driver</th>
                  <th scope="col">Total</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Cancelled</th>
                </tr>
              </thead>
              <tbody id="driverRows">
                <tr><td colspan="4" class="spaTableEmpty">Loading report…</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel tablePanel spaReportCard" aria-labelledby="byCustomerTitle">
          <div class="spaPanelHead">
            <strong id="byCustomerTitle">By customer</strong>
            <span class="mutedText" id="customerMeta">—</span>
          </div>
          <div class="tableWrapper">
            <table class="dataTable" data-mobile-cards>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Total</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Cancelled</th>
                </tr>
              </thead>
              <tbody id="customerRows">
                <tr><td colspan="4" class="spaTableEmpty">Loading report…</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel tablePanel spaReportCard spaReportWide" aria-labelledby="byMonthTitle">
          <div class="spaPanelHead">
            <strong id="byMonthTitle">By month</strong>
            <span class="mutedText" id="monthMeta">—</span>
          </div>
          <div class="tableWrapper">
            <table class="dataTable" data-mobile-cards>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Total</th>
                  <th scope="col">Delivered</th>
                  <th scope="col">Cancelled</th>
                </tr>
              </thead>
              <tbody id="monthRows">
                <tr><td colspan="4" class="spaTableEmpty">Loading report…</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <aside class="spaDetailRail" id="repRail" aria-label="Report snapshot">
      <div class="spaRailHead">
        <div>
          <strong>Report snapshot</strong>
          <span id="railPeriod">Loading…</span>
        </div>
        <button type="button" class="spaRailClose" id="repRailClose" aria-label="Close details">&times;</button>
      </div>
      <div id="repRailBody">
        <p class="mutedText">Loading report…</p>
      </div>
    </aside>
  </div>

  <div class="photoViewer" id="repPhotoViewer" role="dialog" aria-label="Proof of delivery photo">
    <div class="photoViewerBar">
      <button type="button" class="photoViewerClose" id="repPhotoClose" aria-label="Close photo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="5" y1="5" x2="19" y2="19"/>
          <line x1="19" y1="5" x2="5" y2="19"/>
        </svg>
      </button>
    </div>
    <img class="photoViewerImg" id="repPhotoImg" alt="Proof of delivery">
    <p class="photoViewerMissing" id="repPhotoMissing" hidden>Photo unavailable.</p>
  </div>`;

const tableHead = {
  driver: "Driver",
  customer: "Customer",
  month: "Month",
};

const tableTitle = {
  rider: "Rider report row",
  driver: "By driver",
  customer: "By customer",
  month: "By month",
};

export default {
  route: "reports",
  title: "Reports",
  group: "Insights",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
    const fromDate = $("repFrom");
    const toDate = $("repTo");
    const riderFilter = $("riderFilter");
    const genBtn = $("repGenerate");
    const exportBtn = $("repExport");
    const messageEl = $("repMessage");
    const gridEl = $("repGrid");
    const riderRows = $("riderRows");
    const driverRows = $("driverRows");
    const customerRows = $("customerRows");
    const monthRows = $("monthRows");
    const riderMeta = $("riderMeta");
    const driverMeta = $("driverMeta");
    const customerMeta = $("customerMeta");
    const monthMeta = $("monthMeta");
    const rail = $("repRail");
    const railPeriod = $("railPeriod");
    const railBody = $("repRailBody");
    const viewer = $("repPhotoViewer");
    const viewerImg = $("repPhotoImg");
    const viewerMissing = $("repPhotoMissing");
    const viewerClose = $("repPhotoClose");

    let report = null;
    let loadedPeriod = { from: "", to: "" };
    let selection = null; // { kind: "rider"|"driver"|"customer"|"month", key: string }
    let pendingRider = "";
    let loading = true;
    let failure = "";
    let alive = true;
    let msgTimer = null;
    let viewerOpener = null;

    const urlParams = Object.fromEntries(ctx.route.params);
    if (isDateKey(urlParams.from)) fromDate.value = urlParams.from;
    if (isDateKey(urlParams.to)) toDate.value = urlParams.to;
    if (urlParams.rider) pendingRider = urlParams.rider;

    /* ---------- inline message ---------- */

    const clearMsg = () => {
      if (!messageEl) return;
      messageEl.hidden = true;
      messageEl.textContent = "";
    };

    const showMsg = (text) => {
      messageEl.textContent = text;
      messageEl.hidden = false;
      clearTimeout(msgTimer);
      msgTimer = setTimeout(clearMsg, 6000);
    };

    /* ---------- url sync ---------- */

    const syncUrl = () => {
      const next = {};
      if (fromDate.value) next.from = fromDate.value;
      if (toDate.value) next.to = toDate.value;
      if (riderFilter.value) next.rider = riderFilter.value;
      const hash = buildHash("reports", next);
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    };

    /* ---------- data selection ---------- */

    const riderList = () => {
      const list = Array.isArray(report?.rider_reports) ? report.rider_reports : [];
      const rider = riderFilter.value;
      return rider ? list.filter((row) => row.driver_name === rider) : list;
    };

    const selectedRow = () => {
      if (!selection || !report) return null;
      if (selection.kind === "rider") {
        const row = riderList()[Number(selection.key)];
        return row || null;
      }
      const list =
        selection.kind === "driver"
          ? report.by_driver
          : selection.kind === "customer"
            ? report.by_customer
            : report.by_month;
      if (!Array.isArray(list)) return null;
      return (
        list.find((row) =>
          selection.kind === "month" ? row.ym === selection.key : row.name === selection.key
        ) || null
      );
    };

    const selectedLabel = (row) => {
      if (!row) return "";
      if (selection.kind === "month") return fmtMonth(row.ym);
      if (selection.kind === "rider") return row.del_number || "Delivery";
      return row.name || "—";
    };

    /* ---------- summary ---------- */

    const renderSummary = () => {
      const total = Number(report?.total) || 0;
      const delivered = Number(report?.counts?.Delivered) || 0;
      const cancelled = Number(report?.counts?.Cancelled) || 0;
      $("repTotal").textContent = report ? num(total) : "—";
      $("repDelivered").textContent = report ? num(delivered) : "—";
      $("repCancelled").textContent = report ? num(cancelled) : "—";
      $("repRate").textContent = report ? rateLabel(delivered, total) : "—";

      const meta = $("repMeta");
      if (loading) meta.textContent = "Loading…";
      else if (failure) meta.textContent = "Update failed";
      else meta.textContent = `${num(total)} deliveries · ${periodLabel(loadedPeriod)}`;
    };

    /* ---------- tables ---------- */

    const emptyRow = (cols, text) =>
      `<tr><td colspan="${cols}" class="spaTableEmpty">${esc(text)}</td></tr>`;

    const rowState = () => {
      if (loading) return "Loading report…";
      if (failure) return failure;
      return "";
    };

    const riderRowHtml = (row, index) => {
      const active = selection?.kind === "rider" && selection.key === String(index);
      return `<tr class="spaReportRow${active ? " is-selected" : ""}" data-report-row="rider" data-key="${index}" tabindex="0">
        <td data-card-title data-label="Delivery no.">${esc(row.del_number || "—")}</td>
        <td data-label="Customer">${esc(row.customer_name || "—")}</td>
        <td data-label="Delivery date">${esc(row.del_date ? fmtDay(row.del_date) : "—")}</td>
        <td data-label="Delivered at">${esc(fmtDateTime(row.delivered_at))}</td>
        <td data-label="Rider">${esc(row.driver_name || "—")}</td>
        <td data-label="Proof">${proofCell(row.proof_image, row.del_number || "delivery")}</td>
        <td data-label="Notes" class="spaReportNotes" title="${esc(row.rider_notes || "")}">${esc(
          row.rider_notes || "—"
        )}</td>
      </tr>`;
    };

    const renderRiderRows = () => {
      const state = rowState();
      if (state) {
        riderRows.innerHTML = emptyRow(7, state);
        riderMeta.textContent = loading ? "Loading…" : "—";
        return;
      }
      const list = riderList();
      riderMeta.textContent = `${list.length} ${list.length === 1 ? "row" : "rows"}`;
      riderRows.innerHTML = list.length
        ? list.map(riderRowHtml).join("")
        : emptyRow(7, "No rider reports for this period.");
    };

    const aggregateRowHtml = (kind, row, label, key) => {
      const active = selection?.kind === kind && selection.key === String(key);
      return `<tr class="spaReportRow${active ? " is-selected" : ""}" data-report-row="${kind}" data-key="${esc(
        key
      )}" tabindex="0">
        <td data-card-title data-label="${tableHead[kind]}">${esc(label)}</td>
        <td data-label="Total">${esc(row.total)}</td>
        <td data-label="Delivered">${esc(row.delivered)}</td>
        <td data-label="Cancelled">${esc(row.cancelled)}</td>
      </tr>`;
    };

    const renderAggregate = (kind, body, metaEl, list, emptyText, labelFn = (row) => row.name, keyFn = (row) => row.name) => {
      const state = rowState();
      if (state) {
        body.innerHTML = emptyRow(4, state);
        metaEl.textContent = loading ? "Loading…" : "—";
        return;
      }
      const rows = Array.isArray(list) ? list : [];
      metaEl.textContent = `${rows.length} ${rows.length === 1 ? "row" : "rows"}`;
      body.innerHTML = rows.length
        ? rows
            .map((row) =>
              aggregateRowHtml(kind, row, labelFn(row) || "—", keyFn(row))
            )
            .join("")
        : emptyRow(4, emptyText);
    };

    const renderTables = () => {
      renderRiderRows();
      renderAggregate(
        "driver",
        driverRows,
        driverMeta,
        report?.by_driver,
        "No data for this period."
      );
      renderAggregate(
        "customer",
        customerRows,
        customerMeta,
        report?.by_customer,
        "No data for this period."
      );
      renderAggregate(
        "month",
        monthRows,
        monthMeta,
        report?.by_month,
        "No data for this period.",
        (row) => fmtMonth(row.ym),
        (row) => row.ym
      );
    };

    /* ---------- rail ---------- */

    const infoRow = (label, value) =>
      `<div class="viewRow"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

    const totalsHtml = () => {
      const total = Number(report?.total) || 0;
      const delivered = Number(report?.counts?.Delivered) || 0;
      const cancelled = Number(report?.counts?.Cancelled) || 0;
      return `<dl class="viewList">
        ${infoRow("Period", esc(periodLabel(loadedPeriod)))}
        ${infoRow("Total deliveries", esc(num(total)))}
        ${infoRow("Delivered", esc(num(delivered)))}
        ${infoRow("Cancelled", esc(num(cancelled)))}
        ${infoRow("Delivered rate", esc(rateLabel(delivered, total)))}
      </dl>`;
    };

    const railTotals = () => {
      const total = Number(report?.total) || 0;
      const delivered = Number(report?.counts?.Delivered) || 0;
      const cancelled = Number(report?.counts?.Cancelled) || 0;

      if (loading) {
        railBody.innerHTML = `<p class="mutedText">Loading report…</p>`;
        return;
      }
      if (failure) {
        railBody.innerHTML = `<p class="mutedText">${esc(failure)}</p>`;
        return;
      }
      if (!report) {
        railBody.innerHTML = `<p class="mutedText">Generate the report to see the snapshot.</p>`;
        return;
      }

      const row = selectedRow();
      if (!row) {
        railBody.innerHTML = `${totalsHtml()}<p class="spaNote">Select a row in any table to inspect it here.</p>`;
        return;
      }

      if (selection.kind === "rider") {
        railBody.innerHTML = `
          <div class="spaLiveWho">
            <strong>${esc(row.del_number || "Delivery")}</strong>
            <span>${esc(row.customer_name || "—")} · ${esc(
              row.driver_name || "Unassigned"
            )}</span>
          </div>
          <dl class="viewList">
            ${infoRow("Delivery date", esc(row.del_date ? fmtDay(row.del_date) : "—"))}
            ${infoRow("Delivered at", esc(fmtDateTime(row.delivered_at)))}
            ${infoRow("Rider", esc(row.driver_name || "—"))}
          </dl>
          <h3 class="viewSection">Rider notes</h3>
          <p class="spaNote">${esc(row.rider_notes || "No notes submitted.")}</p>
          <h3 class="viewSection">Proof photo</h3>
          ${
            row.proof_image
              ? `<a href="${esc(row.proof_image)}" class="proofLink spaProofLink" data-photo-link data-photo-alt="Proof for ${esc(
                  row.del_number || "delivery"
                )}"><img class="proofThumb" loading="lazy" src="${esc(row.proof_image)}" alt="Proof for ${esc(
                  row.del_number || "delivery"
                )}"></a>`
              : `<p class="proofMissing">No proof photo submitted.</p>`
          }`;
        return;
      }

      const label = selectedLabel(row);
      const totalRow = Number(row.total) || 0;
      const deliveredRow = Number(row.delivered) || 0;
      const cancelledRow = Number(row.cancelled) || 0;
      const otherRow = Math.max(totalRow - deliveredRow - cancelledRow, 0);
      const share = (value) => (totalRow ? (value / totalRow) * 100 : 0);

      railBody.innerHTML = `
        <div class="spaLiveWho">
          <strong>${esc(label)}</strong>
          <span>${esc(tableTitle[selection.kind])} · ${esc(periodLabel(loadedPeriod))}</span>
        </div>
        <div class="spaSegBar" role="img" aria-label="${esc(
          `Delivered ${deliveredRow}, cancelled ${cancelledRow}, other ${otherRow} of ${totalRow}`
        )}">
          <span style="flex:${Math.max(share(deliveredRow), 0.15)};background:var(--green)"></span>
          <span style="flex:${Math.max(share(cancelledRow), 0.15)};background:var(--destructive)"></span>
          <span style="flex:${Math.max(share(otherRow), 0.15)};background:var(--border)"></span>
        </div>
        <div class="spaSegLegend">
          <span><i style="background:var(--green)"></i>Delivered · ${deliveredRow}</span>
          <span><i style="background:var(--destructive)"></i>Cancelled · ${cancelledRow}</span>
          <span><i style="background:var(--border)"></i>Other · ${otherRow}</span>
        </div>
        <dl class="viewList">
          ${infoRow("Period", esc(periodLabel(loadedPeriod)))}
          ${infoRow("Total", esc(num(totalRow)))}
          ${infoRow("Delivered", esc(num(deliveredRow)))}
          ${infoRow("Cancelled", esc(num(cancelledRow)))}
          ${infoRow("Delivered rate", esc(rateLabel(deliveredRow, totalRow)))}
        </dl>
        <p class="spaNote">Pick a delivery row in the rider report to see its proof photo.</p>`;
    };

    const renderRail = () => {
      railPeriod.textContent = loading ? "Loading…" : periodLabel(loadedPeriod);
      rail.classList.toggle("is-open", Boolean(selection) && !loading);
      railTotals();
    };

    const renderAll = () => {
      renderSummary();
      renderTables();
      renderRail();
      updatePrintInfo();
    };

    /* ---------- rider filter ---------- */

    const populateRiders = (list) => {
      const current = pendingRider || riderFilter.value;
      const names = [...new Set((list || []).map((row) => row.driver_name).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      );

      riderFilter.innerHTML =
        `<option value="">All riders</option>` +
        names.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");

      riderFilter.value = names.includes(current) ? current : "";
      pendingRider = "";
    };

    /* ---------- print info ---------- */

    function updatePrintInfo() {
      $("printPeriod").textContent = `Period: ${periodLabel(loadedPeriod)}`;
      $("printRider").textContent = riderFilter.value
        ? `Rider Report filtered by: ${riderFilter.value}`
        : "";
      $("printedOn").textContent = `Printed on: ${new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
    }

    /* ---------- load ---------- */

    const setBusy = (busy) => {
      genBtn.disabled = busy;
      exportBtn.disabled = busy;
      genBtn.textContent = busy ? "Generating…" : "Generate";
    };

    const loadReport = async () => {
      clearMsg();

      if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
        showMsg("The 'From' date must not be later than the 'To' date.");
        return;
      }

      loading = true;
      failure = "";
      report = null;
      selection = null;
      setBusy(true);
      renderAll();

      const params = new URLSearchParams();
      if (fromDate.value) params.set("from", fromDate.value);
      if (toDate.value) params.set("to", toDate.value);
      const query = params.toString();

      try {
        const data = await apiJson(`${REP_API}${query ? `?${query}` : ""}`, {
          signal: ctx.signal,
        });
        if (!alive) return;
        report = data;
        loadedPeriod = { from: fromDate.value, to: toDate.value };
        loading = false;
        populateRiders(data.rider_reports || []);
        syncUrl();
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        loading = false;
        failure = `Failed to load report: ${error?.message || "Unknown error"}`;
        showMsg(failure);
        renderAll();
        return;
      } finally {
        if (alive) setBusy(false);
      }

      renderAll();
    };

    /* ---------- CSV export (same rules as the legacy page) ---------- */

    const csvCell = (value) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    };

    // Keep the leading zero of contact numbers in Excel.
    const csvText = (value) => (value ? `="${String(value).replace(/"/g, '""')}"` : "");

    const csvLink = (path) => {
      if (!path) return "";
      const url = new URL(path, window.location.href).href;
      return `"=HYPERLINK(""${url}"",""View photo"")"`;
    };

    const exportCsv = () => {
      if (!report || !Array.isArray(report.deliveries) || !report.deliveries.length) {
        showMsg("No deliveries to export.");
        return;
      }

      const header = [
        "Delivery No",
        "Customer",
        "Address",
        "Contact",
        "Date",
        "Driver",
        "Vehicle",
        "Item",
        "Quantity",
        "Status",
        "Remarks",
        "Delivered At",
        "Rider Notes",
        "Proof Photo",
      ];

      const rider = riderFilter.value;
      const exportList = rider
        ? report.deliveries.filter((row) => row.driver_name === rider)
        : report.deliveries;
      if (!exportList.length) {
        showMsg("No deliveries to export.");
        return;
      }

      const lines = [header.map(csvCell).join(",")];
      exportList.forEach((row) => {
        lines.push(
          [
            csvCell(row.del_number),
            csvCell(row.customer_name),
            csvCell(row.address),
            csvText(row.contact),
            csvCell(row.del_date),
            csvCell(row.driver_name),
            csvCell(row.vehicle),
            csvCell(row.item_desc),
            csvCell(row.quantity),
            csvCell(row.status),
            csvCell(row.remarks),
            csvCell(row.delivered_at),
            csvCell(row.rider_notes),
            csvLink(row.proof_image),
          ].join(",")
        );
      });

      // \uFEFF = BOM so Excel reads the file as UTF-8.
      const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const clean = rider.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
      const slug = clean ? "_" + clean : "";
      link.download = `deliveries_report${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      ctx.toast("CSV exported", "success");
    };

    /* ---------- proof photo viewer ---------- */

    const viewerOpen = () => viewer.classList.contains("open");

    const closeViewer = () => {
      if (!viewerOpen()) return;
      viewer.classList.remove("open");
      viewerImg.src = "";
      viewerImg.hidden = false;
      viewerMissing.hidden = true;
      const opener = viewerOpener;
      viewerOpener = null;
      if (opener && document.contains(opener) && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
    };

    const openViewer = (href, alt, opener = null) => {
      if (!href) return;
      viewerOpener = opener || document.activeElement;
      viewerImg.hidden = false;
      viewerMissing.hidden = true;
      viewerImg.alt = alt || "Proof of delivery";
      viewerImg.src = href;
      viewer.classList.add("open");
      viewerClose.focus();
    };

    /* ---------- events ---------- */

    const onPrint = () => updatePrintInfo();
    window.addEventListener("beforeprint", onPrint);

    const onKeydown = (event) => {
      if (event.key === "Escape" && viewerOpen()) {
        event.preventDefault();
        closeViewer();
      }
    };
    document.addEventListener("keydown", onKeydown);

    genBtn.addEventListener("click", () => {
      loadReport().catch((error) => console.error(error));
    });

    $("repReset").addEventListener("click", () => {
      fromDate.value = "";
      toDate.value = "";
      riderFilter.value = "";
      pendingRider = "";
      selection = null;
      loadReport().catch((error) => console.error(error));
    });

    exportBtn.addEventListener("click", exportCsv);
    $("repPrint").addEventListener("click", () => window.print());

    riderFilter.addEventListener("change", () => {
      selection = null;
      syncUrl();
      renderTables();
      renderRail();
      updatePrintInfo();
    });

    const selectRow = (row, keepFocus = false) => {
      selection = { kind: row.dataset.reportRow, key: row.dataset.key };
      renderTables();
      renderRail();
      if (!keepFocus) return;
      const next = [...gridEl.querySelectorAll("[data-report-row]")].find(
        (node) =>
          node.dataset.reportRow === selection.kind && node.dataset.key === selection.key
      );
      if (next) next.focus({ preventScroll: true });
    };

    gridEl.addEventListener("click", (event) => {
      if (event.target.closest("[data-photo-link]")) return;
      const row = event.target.closest("[data-report-row]");
      if (!row) return;
      selectRow(row);
    });

    gridEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("a, button")) return;
      const row = event.target.closest("[data-report-row]");
      if (!row) return;
      event.preventDefault();
      selectRow(row, true);
    });

    root.addEventListener("click", (event) => {
      const link = event.target.closest("[data-photo-link]");
      if (!link) return;
      event.preventDefault();
      openViewer(link.getAttribute("href"), link.dataset.photoAlt, link);
    });

    root.addEventListener(
      "error",
      (event) => {
        const target = event.target;
        if (target === viewerImg) {
          viewerImg.hidden = true;
          viewerMissing.hidden = false;
          return;
        }
        if (!(target instanceof HTMLImageElement) || !target.classList.contains("proofThumb")) return;
        const link = target.closest("a");
        if (!link) return;
        const span = document.createElement("span");
        span.className = "proofMissing";
        span.textContent = "Photo unavailable";
        link.replaceWith(span);
      },
      true
    );

    viewerClose.addEventListener("click", closeViewer);
    viewer.addEventListener("click", (event) => {
      if (event.target === viewer) closeViewer();
    });

    $("repRailClose").addEventListener("click", () => {
      selection = null;
      renderTables();
      renderRail();
    });

    /* ---------- boot ---------- */

    updatePrintInfo();
    await loadReport();
    if (!alive) return () => {};

    return () => {
      alive = false;
      clearTimeout(msgTimer);
      window.removeEventListener("beforeprint", onPrint);
      document.removeEventListener("keydown", onKeydown);
      closeViewer();
    };
  },
};

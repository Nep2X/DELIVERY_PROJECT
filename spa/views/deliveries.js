import { apiJson } from "../api.js";
import { destroyMap, loadLeaflet } from "../map-loader.js";
import { buildHash } from "../router.js";
import { closeModal, emptyState, errorState, loadingState, openModal, statusBadge } from "../ui.js";
import { debounce, esc, fmtDate, fmtDateTime, isOverdue } from "../util.js";

const DEL_API = "api/deliveries.php";
const CUS_API = "api/customers.php";
const DRV_API = "api/drivers.php";

const STATUS_LIST = ["Pending", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
const ACTIVE_STATUSES = ["Pending", "Processing", "Out for Delivery"];
const MAX_STOPS = 5;
const MAP_CENTER = [12.8797, 121.774];

const stopNames = (delivery) =>
  String(delivery?.customer_list || delivery?.customer_name || "")
    .split("||")
    .map((name) => name.trim())
    .filter(Boolean);

const sameName = (a, b) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

const fillSelect = (select, names, placeholder, current = "") => {
  const list = [...names];
  if (current && !list.includes(current)) list.unshift(current);
  select.innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    list
      .map(
        (name) =>
          `<option value="${esc(name)}"${name === current ? " selected" : ""}>${esc(name)}</option>`
      )
      .join("");
};

const nextDeliveryNumber = (deliveries) => {
  const numbers = deliveries
    .map((delivery) => parseInt(String(delivery.del_number).replace(/\D/g, ""), 10))
    .filter((value) => !Number.isNaN(value));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `DEL-${String(next).padStart(3, "0")}`;
};

const template = () => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Deliveries</h1>
      <p>Manage all delivery transactions.</p>
    </div>
    <div class="spaHeadMeta"><span id="delMeta">Loading…</span></div>
  </div>

  <div class="spaDeliveries">
    <section class="spaPanel spaDelList" aria-label="Delivery list">
      <div class="spaDelFilters">
        <div class="spaChipRow" id="delChips" role="group" aria-label="Filter by status"><button type="button" class="spaCta" id="delNewBtn" style="min-height:32px;padding:4px 14px;">+ New Delivery</button></div>
        <div class="spaDelFilterRow">
          <select id="delDriverFilter" aria-label="Filter by driver"></select>
          <input type="date" id="delDateFilter" aria-label="Filter by date">
          <button type="button" class="btnOutline" id="delClearFilters">Clear</button>
        </div>
      </div>
      <div class="spaDelRows" id="delRows"></div>
    </section>

    <div class="spaDelMain">
      <section class="spaPanel spaDelMapPanel" aria-label="Delivery destination map">
        <div class="spaPanelHead">
          <strong>Destination</strong>
          <span class="mutedText" id="delMapMeta">—</span>
        </div>
        <div class="spaDelMapWrap">
          <div class="spaDelMap" id="delMap" aria-label="Delivery destination map"></div>
          <div class="spaMapNotice" id="delMapNotice" hidden>
            <strong id="delMapNoticeTitle">Select a delivery</strong>
            <p id="delMapNoticeText">Pick a delivery to see its destination pin.</p>
          </div>
        </div>
      </section>

      <section class="spaPanel spaDelDetails" id="delDetails" aria-label="Delivery details">
        <div class="spaPanelHead">
          <strong>Delivery details</strong>
          <button type="button" class="spaRailClose" id="delDetailsClose" aria-label="Close details">&times;</button>
        </div>
        <div class="spaPanelBody" id="delDetailsBody"></div>
      </section>
    </div>
  </div>

  <div class="modal" id="viewModal" role="dialog" aria-modal="true" aria-labelledby="viewTitle">
    <div class="modalBox viewBox">
      <div class="modalHeader">
        <h2 id="viewTitle">Delivery</h2>
        <button class="modalClose" id="closeViewModal" type="button" aria-label="Close">&times;</button>
      </div>
      <div id="viewBody"></div>
    </div>
  </div>

  <div class="modal" id="deliveryModal" role="dialog" aria-modal="true" aria-labelledby="delModalTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="delModalTitle">Add Delivery</h2>
        <button class="modalClose" id="closeModal" type="button" aria-label="Close">&times;</button>
      </div>

      <form id="deliveryForm">
        <label for="delNumber">Delivery Number</label>
        <input type="text" id="delNumber" name="delNumber" required readonly>

        <label for="delDate">Delivery Date</label>
        <input type="date" id="delDate" name="delDate" required>

        <label for="driverAssign">Driver Assignment</label>
        <select id="driverAssign" name="driverAssign" required></select>

        <label for="vehicle">Vehicle</label>
        <input type="text" id="vehicle" name="vehicle" placeholder="Vehicle plate / model" maxlength="50" required>

        <h2 style="margin:22px 0 2px;font-size:15px;">Customers</h2>

        <div class="customerBatch">
          <label for="customerName">Customer 1</label>
          <select id="customerName" name="customerName" required></select>

          <label for="delAddress">Delivery Address</label>
          <input type="text" id="delAddress" name="delAddress" placeholder="Auto-filled from the selected customer" readonly>

          <label for="contactNumber">Contact Number</label>
          <input type="text" id="contactNumber" name="contactNumber" placeholder="09XXXXXXXXX" maxlength="20" required>

          <label for="itemDesc">Item / Description</label>
          <input type="text" id="itemDesc" name="itemDesc" placeholder="Item description" maxlength="120" required>

          <label for="quantity">Quantity</label>
          <input type="number" id="quantity" name="quantity" min="1" max="999" placeholder="0" required>

          <div id="extraStops"></div>
        </div>

        <div id="extraStopsBox">
          <button type="button" class="btnOutline" id="addStopBtn">+ Add another customer</button>
          <br><small>Only customers in the same area (all North or all South of the company) can share one delivery. Maximum of 5 customers.</small>
        </div>

        <label for="remarks">Remarks</label>
        <textarea id="remarks" name="remarks" rows="3" placeholder="Optional notes" maxlength="500"></textarea>

        <div class="modalActions">
          <button type="submit" class="btnPrimary" id="delSubmitBtn">Add Delivery</button>
          <button type="button" class="btnDanger" id="cancelModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal" id="statusModal" role="dialog" aria-modal="true" aria-label="Update Status">
    <div class="modalBox">
      <div class="modalHeader">
        <h2>Update Status</h2>
        <button class="modalClose" id="closeStatusModal" type="button" aria-label="Close">&times;</button>
      </div>

      <form id="statusForm">
        <label for="newStatus">Status</label>
        <select id="newStatus" name="status">
          ${STATUS_LIST.map((status) => `<option value="${status}">${status}</option>`).join("")}
        </select>

        <div class="modalActions">
          <button type="submit" class="btnPrimary">Update</button>
          <button type="button" class="btnDanger" id="cancelStatusModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal" id="historyModal" role="dialog" aria-modal="true" aria-labelledby="historyTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="historyTitle">Delivery History</h2>
        <button class="modalClose" id="closeHistoryModal" type="button" aria-label="Close">&times;</button>
      </div>

      <div class="historyList" id="historyList"></div>

      <div class="modalActions">
        <button type="button" class="btnOutline" id="closeHistoryBtn">Close</button>
      </div>
    </div>
  </div>`;

export default {
  route: "deliveries",
  title: "Deliveries",
  group: "Operations",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
    const rowsEl = $("delRows");
    const chipsEl = $("delChips");
    const driverFilter = $("delDriverFilter");
    const dateFilter = $("delDateFilter");
    const metaEl = $("delMeta");
    const details = $("delDetails");
    const detailsBody = $("delDetailsBody");
    const mapEl = $("delMap");
    const mapMeta = $("delMapMeta");
    const mapNotice = $("delMapNotice");
    const mapNoticeTitle = $("delMapNoticeTitle");
    const mapNoticeText = $("delMapNoticeText");
    const modal = $("deliveryModal");
    const form = $("deliveryForm");
    const statusModal = $("statusModal");
    const statusForm = $("statusForm");
    const historyModal = $("historyModal");
    const historyList = $("historyList");
    const viewModal = $("viewModal");
    const viewBody = $("viewBody");
    const extraStops = $("extraStops");
    const extraStopsBox = $("extraStopsBox");

    let deliveries = [];
    let customers = [];
    let drivers = [];
    let query = "";
    let statusFilter = "";
    let selectedId = null;
    let editingId = null;
    let statusId = null;
    let viewingId = null;
    let loading = true;
    let failure = "";
    let alive = true;
    let refreshing = false;

    const urlParams = Object.fromEntries(ctx.route.params);

    const syncUrl = (patch) => {
      Object.assign(urlParams, patch);
      Object.keys(urlParams).forEach((key) => {
        if (urlParams[key] === null || urlParams[key] === undefined || urlParams[key] === "") {
          delete urlParams[key];
        }
      });
      const hash = buildHash("deliveries", urlParams);
      if (window.location.hash !== hash) {
        window.history.replaceState(null, "", hash);
      }
    };

    /* ---------- data ---------- */

    const fetchList = async (url) => {
      try {
        const response = await fetch(url, { signal: ctx.signal });
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        if (error?.name !== "AbortError") console.error(`Failed to load ${url}`, error);
        return [];
      }
    };

    const selectedDelivery = () => deliveries.find((item) => item.id === selectedId) || null;

    const anyModalOpen = () =>
      [modal, statusModal, historyModal, viewModal].some(
        (node) => node && node.style.display === "flex"
      );

    /* ---------- chips + filters ---------- */

        const renderChips = () => {
      const chips = [{ value: "", label: "All" }].concat(
        STATUS_LIST.map((status) => ({ value: status, label: status }))
      );
      chipsEl.querySelectorAll(".spaChip").forEach((node) => node.remove());
      chipsEl.insertAdjacentHTML(
        "afterbegin",
        chips
          .map(
            (chip) =>
              `<button type="button" class="spaChip" data-status="${esc(chip.value)}" aria-pressed="${
                statusFilter === chip.value ? "true" : "false"
              }">${esc(chip.label)}</button>`
          )
          .join("")
      );
    };

    const renderDriverFilter = () => {
      const current = driverFilter.value;
      fillSelect(
        driverFilter,
        drivers.map((driver) => driver.name),
        "All drivers",
        current
      );
    };

    /* ---------- filtering ---------- */

    const filtered = () => {
      const needle = query.trim().toLowerCase();
      const driver = driverFilter.value;
      const date = dateFilter.value;
      return deliveries.filter((delivery) => {
        if (statusFilter && delivery.status !== statusFilter) return false;
        if (driver && delivery.driver_name !== driver) return false;
        if (date && delivery.del_date !== date) return false;
        if (!needle) return true;
        return `${delivery.del_number ?? ""} ${delivery.customer_list ?? delivery.customer_name ?? ""} ${
          delivery.driver_name ?? ""
        } ${delivery.item_desc ?? ""}`
          .toLowerCase()
          .includes(needle);
      });
    };

    /* ---------- list ---------- */

    const rowHtml = (delivery) => {
      const names = stopNames(delivery);
      const first = names[0] || delivery.customer_name || "No customer";
      const extra = Math.max(names.length - 1, 0);
      return `<button type="button" class="spaDelRow${
        selectedId === delivery.id ? " is-selected" : ""
      }" data-id="${delivery.id}">
        <span class="spaDelRowTop">
          <strong>${esc(delivery.del_number || "—")}</strong>
          ${statusBadge(delivery.status)}
        </span>
        <span class="spaDelRowCustomer">${esc(first)}${
          extra ? ` <span class="mutedText">+${extra} more</span>` : ""
        }</span>
        <span class="spaDelRowMeta">
          <span>${esc(delivery.driver_name || "Unassigned")}</span>
          <span>${esc(fmtDate(delivery.del_date))}${isOverdue(delivery) ? " · Overdue" : ""}</span>
          <span>${names.length || 1} ${names.length === 1 ? "stop" : "stops"}</span>
        </span>
      </button>`;
    };

    const renderList = () => {
      const scrollTop = rowsEl.scrollTop;

      if (loading) {
        rowsEl.innerHTML = loadingState("Loading deliveries…");
        metaEl.textContent = "Loading…";
        return;
      }
      if (failure) {
        rowsEl.innerHTML = `${errorState(failure)}<button type="button" class="btnOutline" data-retry>Try again</button>`;
        metaEl.textContent = "Update failed";
        return;
      }

      const list = filtered();
      metaEl.textContent = `${list.length} of ${deliveries.length} deliveries`;

      if (!list.length) {
        rowsEl.innerHTML = emptyState({
          title: "No deliveries found",
          message: deliveries.length
            ? "Try a different search, status, driver, or date."
            : "Create the first delivery to get started.",
        });
        return;
      }

      rowsEl.innerHTML = list.map(rowHtml).join("");
      rowsEl.scrollTop = scrollTop;
    };

    /* ---------- map ---------- */

    let map = null;
    let markerLayer = null;
    let mapToken = 0;

    const tileUrl = () =>
      typeof window.mapTileUrl === "function"
        ? window.mapTileUrl()
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const tileAttribution = () =>
      typeof window.mapAttribution === "function" ? window.mapAttribution() : "&copy; OpenStreetMap";
    const tileMaxNativeZoom = () =>
      typeof window.mapMaxNativeZoom === "function" ? window.mapMaxNativeZoom() : 19;

    const pinIcon = (L) =>
      L.divIcon({
        className: "",
        html: `<span class="customerPin" aria-hidden="true"></span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

    const showNotice = (title, text) => {
      mapNoticeTitle.textContent = title;
      mapNoticeText.textContent = text;
      mapNotice.hidden = false;
    };

    const hideNotice = () => {
      mapNotice.hidden = true;
    };

    const ensureMap = async () => {
      const L = await loadLeaflet();
      if (!alive) return null;
      if (!map) {
        map = L.map(mapEl, { scrollWheelZoom: false }).setView(MAP_CENTER, 6);
        L.tileLayer(tileUrl(), {
          maxZoom: 19,
          maxNativeZoom: tileMaxNativeZoom(),
          attribution: tileAttribution(),
          subdomains: "abcd",
        }).addTo(map);
        markerLayer = L.layerGroup().addTo(map);
      }
      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          /* view is being replaced */
        }
      });
      return L;
    };

    const renderMap = async () => {
      const token = ++mapToken;
      const delivery = selectedDelivery();

      if (!delivery) {
        if (markerLayer) markerLayer.clearLayers();
        mapMeta.textContent = "—";
        showNotice("Select a delivery", "Pick a delivery to see its destination pin.");
        return;
      }

      const names = stopNames(delivery);
      if (!names.length) {
        if (markerLayer) markerLayer.clearLayers();
        mapMeta.textContent = "No customer";
        showNotice("No customer yet", "This delivery has no customer record to place on the map.");
        return;
      }

      const located = names
        .map((name) => customers.find((customer) => sameName(customer.name, name)))
        .filter(
          (customer) =>
            customer &&
            customer.lat !== null &&
            customer.lat !== undefined &&
            customer.lng !== null &&
            customer.lng !== undefined &&
            Number.isFinite(Number(customer.lat)) &&
            Number.isFinite(Number(customer.lng))
        );

      if (!located.length) {
        if (markerLayer) markerLayer.clearLayers();
        mapMeta.textContent = "No location";
        showNotice(
          "No map location for this customer yet.",
          "Open the customer in Customers and save an address on the map."
        );
        return;
      }

      let L;
      try {
        L = await ensureMap();
      } catch (error) {
        if (token === mapToken && alive) {
          mapMeta.textContent = "Map unavailable";
          showNotice("Map unavailable", "The map library could not load. Details still work.");
        }
        console.error(error);
        return;
      }
      if (!L || token !== mapToken) return;

      markerLayer.clearLayers();
      const points = [];
      located.forEach((customer) => {
        const at = [Number(customer.lat), Number(customer.lng)];
        points.push(at);
        L.marker(at, { icon: pinIcon(L), title: customer.name }).addTo(markerLayer);
      });

      hideNotice();
      mapMeta.textContent = `${points.length} of ${names.length} ${
        names.length === 1 ? "stop" : "stops"
      } on map`;

      if (points.length === 1) map.setView(points[0], 15);
      else map.fitBounds(L.latLngBounds(points).pad(0.25), { maxZoom: 15 });
    };

    /* ---------- details ---------- */

    const viewRow = (label, valueHtml) =>
      `<div class="viewRow"><dt>${esc(label)}</dt><dd>${valueHtml}</dd></div>`;

    const renderDetails = () => {
      const delivery = selectedDelivery();
      details.classList.toggle("is-open", Boolean(delivery));

      if (!delivery) {
        detailsBody.innerHTML = `<div class="spaEmpty"><strong>No delivery selected</strong><p>Pick one from the list to see its details.</p></div>`;
        return;
      }

      const names = stopNames(delivery);
      detailsBody.innerHTML = `
        <div class="spaRailHead">
          <div>
            <strong>${esc(delivery.del_number || "Delivery")}</strong>
            <span>${statusBadge(delivery.status)}${
              isOverdue(delivery) ? ' <span class="statusBadge lateBadge">Overdue</span>' : ""
            }</span>
          </div>
        </div>

        <dl class="viewList">
          ${viewRow("Date", esc(fmtDate(delivery.del_date) || "-"))}
          ${viewRow("Driver", esc(delivery.driver_name || "Unassigned"))}
          ${viewRow("Vehicle", esc(delivery.vehicle || "-"))}
          ${viewRow("Customers", esc(String(names.length || 1)))}
          ${viewRow("Remarks", esc(delivery.remarks || "-"))}
          ${
            delivery.delivered_at
              ? viewRow("Delivered at", esc(fmtDateTime(delivery.delivered_at)))
              : ""
          }
        </dl>

        <h3 class="viewSection">${names.length > 1 ? `Customers (${names.length})` : "Customer"}</h3>
        <div class="viewStop">
          <div class="viewStopHead"><b>${esc(names[0] || delivery.customer_name || "-")}</b></div>
          <dl class="viewList">
            ${viewRow("Address", esc(delivery.address || "-"))}
            ${viewRow("Contact", esc(delivery.contact || "-"))}
            ${viewRow(
              "Item",
              esc(delivery.item_desc || "-") + " (Qty: " + esc(delivery.quantity ?? 1) + ")"
            )}
          </dl>
        </div>

        <div class="spaRailActions">
          <button type="button" class="btnPrimary" data-del-action="view">View</button>
          <button type="button" class="btnOutline" data-del-action="edit">Edit</button>
          <button type="button" class="btnOutline" data-del-action="status">Status</button>
          <button type="button" class="btnOutline" data-del-action="history">History</button>
          <button type="button" class="btnOutline" data-del-action="delete">Delete</button>
        </div>`;
    };

    const select = (id) => {
      selectedId = id;
      syncUrl({ selected: id ?? null });
      renderList();
      renderDetails();
      renderMap().catch((error) => console.error(error));
    };

    /* ---------- load ---------- */

    const loadDeliveries = async () => {
      const data = await apiJson(DEL_API, { signal: ctx.signal });
      if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
      return data;
    };

    const load = async () => {
      loading = true;
      failure = "";
      renderList();

      const [deliveriesResult, customersResult, driversResult] = await Promise.allSettled([
        loadDeliveries(),
        fetchList(CUS_API),
        fetchList(DRV_API),
      ]);
      if (!alive) return;

      customers = customersResult.status === "fulfilled" ? customersResult.value : [];
      drivers = driversResult.status === "fulfilled" ? driversResult.value : [];

      if (deliveriesResult.status === "fulfilled") {
        deliveries = deliveriesResult.value;
        loading = false;
      } else {
        const error = deliveriesResult.reason;
        if (error?.name === "AbortError") return;
        console.error(error);
        loading = false;
        failure = error?.message || "Could not load deliveries.";
      }

      renderDriverFilter();
      renderChips();
      renderList();
      renderDetails();
      renderMap().catch((error) => console.error(error));
    };

    const refreshDeliveries = async () => {
      if (refreshing || loading) return;
      refreshing = true;
      try {
        deliveries = await loadDeliveries();
        if (!alive) return;
        if (selectedId && !deliveries.some((item) => item.id === selectedId)) {
          selectedId = null;
          syncUrl({ selected: null });
        }
        renderList();
        renderDetails();
        renderMap().catch((error) => console.error(error));
      } catch (error) {
        if (error?.name !== "AbortError") console.error(error);
      } finally {
        refreshing = false;
      }
    };

    /* ---------- add / edit ---------- */

    const refreshStopChoices = () => {
      extraStops.querySelectorAll(".xsTitle").forEach((title, index) => {
        title.textContent = `Customer ${index + 2}`;
      });
      const selects = [...extraStops.querySelectorAll(".xsCustomer")];
      const chosen = [form.elements.customerName.value, ...selects.map((select) => select.value)]
        .filter(Boolean);
      selects.forEach((select) => {
        [...select.options].forEach((option) => {
          option.disabled =
            Boolean(option.value) && option.value !== select.value && chosen.includes(option.value);
        });
      });
    };

    const addStopRow = () => {
      if (extraStops.children.length >= MAX_STOPS - 1) {
        ctx.toast(`A delivery can have at most ${MAX_STOPS} customers.`, "error");
        return;
      }
      const row = document.createElement("div");
      row.className = "extraStopRow";
      row.style.cssText =
        "display:grid;gap:8px;margin:0;padding:12px 0 0;border-top:1px solid var(--border-soft);";
      row.innerHTML = `
        <b class="xsTitle"></b>
        <select class="xsCustomer" required></select>
        <small class="xsAddress"></small>
        <input type="text" class="xsItem" maxlength="120" placeholder="Item description" required>
        <input type="number" class="xsQty" min="1" max="999" placeholder="Quantity" required>
        <button type="button" class="btnOutline xsRemove">Remove</button>`;
      fillSelect(row.querySelector(".xsCustomer"), customers.map((customer) => customer.name), "Select customer");
      extraStops.appendChild(row);
      refreshStopChoices();
    };

    const prepareForm = async (delivery = null) => {
      const [customersResult, driversResult] = await Promise.all([
        fetchList(CUS_API),
        fetchList(DRV_API),
      ]);
      if (!alive) return;
      customers = customersResult;
      drivers = driversResult;

      form.elements.delNumber.readOnly = !delivery;
      form.elements.delAddress.readOnly = !delivery;
      editingId = delivery ? delivery.id : null;
      $("delModalTitle").textContent = delivery ? "Edit Delivery" : "Add Delivery";
      $("delSubmitBtn").textContent = delivery ? "Save Changes" : "Add Delivery";
      form.reset();
      extraStops.innerHTML = "";
      extraStopsBox.style.display = delivery ? "none" : "";

      fillSelect(
        form.elements.customerName,
        customers.map((customer) => customer.name),
        customers.length ? "Select customer" : "No customers yet - add one in the Customers page",
        delivery?.customer_name ?? ""
      );
      fillSelect(
        form.elements.driverAssign,
        drivers.map((driver) => driver.name),
        drivers.length ? "Select driver" : "No drivers yet - create a Driver account in Settings",
        delivery?.driver_name ?? ""
      );

      const busy = new Set(
        deliveries
          .filter(
            (item) =>
              ACTIVE_STATUSES.includes(item.status) &&
              item.driver_name &&
              (!delivery || item.id !== delivery.id)
          )
          .map((item) => item.driver_name)
      );
      [...form.elements.driverAssign.options].forEach((option) => {
        if (
          option.value &&
          busy.has(option.value) &&
          option.value !== (delivery?.driver_name ?? "")
        ) {
          option.disabled = true;
          option.textContent = `${option.value} (has active delivery)`;
        }
      });

      if (delivery) {
        form.elements.delNumber.value = delivery.del_number ?? "";
        form.elements.delAddress.value = delivery.address ?? "";
        form.elements.contactNumber.value = delivery.contact ?? "";
        form.elements.delDate.value = delivery.del_date ?? "";
        form.elements.vehicle.value = delivery.vehicle ?? "";
        form.elements.itemDesc.value = delivery.item_desc ?? "";
        form.elements.quantity.value = delivery.quantity ?? "";
        form.elements.remarks.value = delivery.remarks ?? "";
      } else {
        form.elements.delNumber.value = nextDeliveryNumber(deliveries);
      }
    };

    const openAdd = async () => {
      await prepareForm(null);
      if (!alive) return;
      openModal(modal, { focus: "#customerName" });
    };

    form.elements.customerName.addEventListener("change", (event) => {
      const customer = customers.find((item) => item.name === event.target.value);
      if (!customer) return;
      form.elements.delAddress.value = customer.address ?? "";
      form.elements.contactNumber.value = customer.contact ?? "";
      refreshStopChoices();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      body.extraCustomers = [...extraStops.querySelectorAll(".extraStopRow")].map((row) => ({
        customerName: row.querySelector(".xsCustomer").value,
        itemDesc: row.querySelector(".xsItem").value.trim(),
        quantity: row.querySelector(".xsQty").value,
      }));
      body.status = editingId
        ? (deliveries.find((item) => item.id === editingId)?.status ?? "Pending")
        : "Pending";

      const editing = editingId;
      const submitBtn = $("delSubmitBtn");
      const label = submitBtn.textContent;
      submitBtn.disabled = true;

      try {
        await apiJson(editing ? `${DEL_API}?id=${editing}` : DEL_API, {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctx.signal,
        });
        closeModal(modal);
        ctx.toast(editing ? "Delivery updated" : "Delivery added", "success");
        editingId = null;
        await refreshDeliveries();
        if (editing) select(editing);
      } catch (error) {
        ctx.toast(error.message || "Could not save the delivery.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = label;
      }
    });

    $("addStopBtn").addEventListener("click", addStopRow);
    extraStops.addEventListener("change", (event) => {
      if (!event.target.classList.contains("xsCustomer")) return;
      const customer = customers.find((item) => item.name === event.target.value);
      event.target.closest(".extraStopRow").querySelector(".xsAddress").textContent =
        customer?.address ?? "";
      refreshStopChoices();
    });
    extraStops.addEventListener("click", (event) => {
      if (!event.target.classList.contains("xsRemove")) return;
      event.target.closest(".extraStopRow").remove();
      refreshStopChoices();
    });

    /* ---------- status ---------- */

    const openStatus = (delivery) => {
      statusId = delivery.id;
      statusForm.elements.status.value = delivery.status || "Pending";
      openModal(statusModal, { focus: "#newStatus" });
    };

    statusForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = statusId;
      const submitBtn = statusForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await apiJson(`${DEL_API}?id=${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusForm.elements.status.value }),
          signal: ctx.signal,
        });
        closeModal(statusModal);
        ctx.toast("Status updated", "success");
        statusId = null;
        await refreshDeliveries();
      } catch (error) {
        ctx.toast(error.message || "Could not update the status.", "error");
      } finally {
        submitBtn.disabled = false;
      }
    });

    /* ---------- history ---------- */

    const openHistory = async (delivery) => {
      $("historyTitle").textContent = `History — ${delivery.del_number}`;
      historyList.innerHTML = `<p class="historyEmpty">Loading...</p>`;
      openModal(historyModal, { focus: "#closeHistoryModal" });

      try {
        const data = await apiJson(`${DEL_API}?action=events&id=${delivery.id}`, {
          signal: ctx.signal,
        });
        if (!alive) return;
        const events = Array.isArray(data.events) ? data.events : [];
        if (!events.length) {
          historyList.innerHTML = `<p class="historyEmpty">No history yet. Changes will appear here.</p>`;
          return;
        }
        historyList.innerHTML = events
          .map(
            (item) => `
            <div class="historyItem">
              ${statusBadge(item.status)}
              <div class="historyMeta">
                <b>${esc(item.username || "System")}</b>
                <span>${esc(fmtDateTime(item.created_at))}</span>
              </div>
              ${item.note ? `<p>${esc(item.note)}</p>` : ""}
            </div>`
          )
          .join("");
      } catch (error) {
        if (error?.name === "AbortError") return;
        historyList.innerHTML = `<p class="historyEmpty">Failed to load: ${esc(
          error.message || "Unknown error"
        )}</p>`;
      }
    };

    /* ---------- view ---------- */

    const viewStopsHtml = (stops) =>
      `<h3 class="viewSection">${stops.length > 1 ? `Customers (${stops.length})` : "Customer"}</h3>` +
      stops
        .map(
          (stop) => `
          <div class="viewStop">
            <div class="viewStopHead"><b>${esc(stop.customer_name)}</b>${statusBadge(stop.status)}</div>
            <dl class="viewList">
              ${viewRow("Address", esc(stop.address || "-"))}
              ${viewRow("Contact", esc(stop.contact || "-"))}
              ${viewRow("Item", esc(stop.item_desc || "-") + " (Qty: " + esc(stop.quantity ?? 1) + ")")}
              ${stop.delivered_at ? viewRow("Delivered at", esc(fmtDateTime(stop.delivered_at))) : ""}
              ${stop.rider_notes ? viewRow("Rider notes", esc(stop.rider_notes)) : ""}
            </dl>
          </div>`
        )
        .join("");

    const renderView = (delivery, stops) => {
      $("viewTitle").textContent = delivery.del_number;
      viewBody.innerHTML = `
        <dl class="viewList">
          ${viewRow(
            "Status",
            statusBadge(delivery.status) +
              (isOverdue(delivery) ? ' <span class="statusBadge lateBadge">Overdue</span>' : "")
          )}
          ${viewRow("Date", esc(fmtDate(delivery.del_date) || "-"))}
          ${viewRow("Driver", esc(delivery.driver_name || "-"))}
          ${viewRow("Vehicle", esc(delivery.vehicle || "-"))}
          ${viewRow("Remarks", esc(delivery.remarks || "-"))}
          ${delivery.delivered_at ? viewRow("Delivered at", esc(fmtDateTime(delivery.delivered_at))) : ""}
        </dl>
        ${viewStopsHtml(stops)}`;
    };

    const openView = async (delivery) => {
      viewingId = delivery.id;
      renderView(delivery, [
        {
          customer_name: delivery.customer_name,
          address: delivery.address,
          contact: delivery.contact,
          item_desc: delivery.item_desc,
          quantity: delivery.quantity,
          status: delivery.status,
          delivered_at: delivery.delivered_at,
          rider_notes: delivery.rider_notes,
        },
      ]);
      openModal(viewModal, { focus: "#closeViewModal" });
      const box = viewModal.querySelector(".modalBox");
      if (box) box.scrollTop = 0;

      try {
        const data = await apiJson(`${DEL_API}?action=stops&id=${delivery.id}`, {
          signal: ctx.signal,
        });
        if (!alive || viewingId !== delivery.id) return;
        if (Array.isArray(data.stops) && data.stops.length) renderView(delivery, data.stops);
      } catch {
        /* the summary is already on screen */
      }
    };

    /* ---------- delete ---------- */

    const removeDelivery = async (delivery) => {
      const confirmed = await ctx.confirm(`Delete delivery ${delivery.del_number}?`);
      if (!confirmed) return;
      try {
        await apiJson(`${DEL_API}?id=${delivery.id}`, { method: "DELETE", signal: ctx.signal });
        if (selectedId === delivery.id) {
          selectedId = null;
          syncUrl({ selected: null });
        }
        ctx.toast("Delivery deleted", "success");
        await refreshDeliveries();
        renderDetails();
        renderMap().catch((error) => console.error(error));
      } catch (error) {
        ctx.toast(error.message || "Could not delete the delivery.", "error");
      }
    };

    /* ---------- events ---------- */

    rowsEl.addEventListener("click", (event) => {
      if (event.target.closest("[data-retry]")) {
        load().catch((error) => console.error(error));
        return;
      }
      const row = event.target.closest("[data-id]");
      if (!row) return;
      const id = Number(row.dataset.id);
      if (!Number.isNaN(id)) select(id);
    });

    chipsEl.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-status]");
      if (!chip) return;
      statusFilter = chip.dataset.status;
      renderChips();
      renderList();
    });

    driverFilter.addEventListener("change", renderList);
    dateFilter.addEventListener("change", renderList);
    $("delClearFilters").addEventListener("click", () => {
      statusFilter = "";
      driverFilter.value = "";
      dateFilter.value = "";
      renderChips();
      renderList();
    });

    detailsBody.addEventListener("click", (event) => {
      const action = event.target.closest("[data-del-action]")?.dataset.delAction;
      if (!action) return;
      const delivery = selectedDelivery();
      if (!delivery) return;
      if (action === "view") openView(delivery);
      if (action === "edit") {
        prepareForm(delivery).then(
          () => alive && openModal(modal, { focus: "#customerName" }),
          (error) => console.error(error)
        );
      }
      if (action === "status") openStatus(delivery);
      if (action === "history") openHistory(delivery);
      if (action === "delete") removeDelivery(delivery);
    });

    $("delDetailsClose").addEventListener("click", () => {
      selectedId = null;
      syncUrl({ selected: null });
      renderList();
      renderDetails();
      renderMap().catch((error) => console.error(error));
    });

    $("closeModal").addEventListener("click", () => closeModal(modal));
    $("cancelModal").addEventListener("click", () => closeModal(modal));
    $("closeStatusModal").addEventListener("click", () => closeModal(statusModal));
    $("cancelStatusModal").addEventListener("click", () => closeModal(statusModal));
    $("closeHistoryModal").addEventListener("click", () => closeModal(historyModal));
    $("closeHistoryBtn").addEventListener("click", () => closeModal(historyModal));
    $("closeViewModal").addEventListener("click", () => {
      viewingId = null;
      closeModal(viewModal);
    });

    [modal, statusModal, historyModal, viewModal].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        if (dialog === viewModal) viewingId = null;
        closeModal(dialog);
      });
    });

    ctx.setSearch({
      placeholder: "Search delivery, customer, driver, or item",
      label: "Search deliveries",
      onInput: debounce((value) => {
        query = value;
        renderList();
      }, 120),
    });

    $("delNewBtn").addEventListener("click", () => openAdd().catch((error) => console.error(error)));

    /* ---------- boot ---------- */

    await load();
    if (!alive) return;

    if (urlParams.selected) {
      const wanted = Number(urlParams.selected);
      if (deliveries.some((item) => item.id === wanted)) select(wanted);
      else syncUrl({ selected: null });
    }

    if (urlParams.new === "1") {
      syncUrl({ new: null });
      openAdd().catch((error) => console.error(error));
    }

    const timer = setInterval(() => {
      if (document.hidden || anyModalOpen()) return;
      refreshDeliveries().catch(() => {});
    }, 30000);

    const onVisible = () => {
      if (!document.hidden && !anyModalOpen()) refreshDeliveries().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    const onResize = debounce(() => {
      if (!map) return;
      try {
        map.invalidateSize();
      } catch {
        /* map removed */
      }
    }, 150);
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("resize", onResize);
      [modal, statusModal, historyModal, viewModal].forEach((dialog) => {
        closeModal(dialog);
        dialog.remove();
      });
      if (map) {
        destroyMap(map);
        map = null;
        markerLayer = null;
      }
    };
  },
};

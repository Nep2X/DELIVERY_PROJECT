import { apiJson } from "../api.js";
import { destroyMap, loadLeaflet } from "../map-loader.js";
import { closeModal, emptyState, errorState, loadingState, openModal } from "../ui.js";
import { debounce, esc } from "../util.js";

const CUS_API = "api/customers.php";
const ADDR_FIELDS = ["street", "city", "province"];
const MAP_CENTER = [12.8797, 121.774];

const ICONS = {
  edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
  delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const splitAddress = (address) => {
  const parts = String(address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      street: parts.slice(0, -2).join(", "),
      city: parts[parts.length - 2],
      province: parts[parts.length - 1],
    };
  }
  return { street: parts.join(", "), city: "", province: "" };
};

const template = () => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Customers</h1>
      <p>Saved delivery addresses and their delivery counts.</p>
    </div>
  </div>

  <div class="spaWorkspace">
    <div class="spaWorkspaceMain">
      <div class="panel tablePanel">
        <div class="spaPanelHead">
          <strong>Customer list</strong>
          <span class="mutedText" id="customerCount">—</span>
        </div>
        <div class="tableWrapper">
          <table class="dataTable" data-mobile-cards>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Contact</th>
                <th scope="col">Address</th>
                <th scope="col">Deliveries</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody id="customerRows">
              <tr><td colspan="5">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="spaDetailRail" id="customerRail" aria-label="Customer details">
      <div class="spaRailHead">
        <div>
          <strong>Customer details</strong>
          <span>Select a customer to view the record</span>
        </div>
        <button type="button" class="spaRailClose" id="customerRailClose" aria-label="Close details">&times;</button>
      </div>
      <div id="customerRailBody">
        <p class="mutedText">No customer selected.</p>
      </div>
    </aside>
  </div>

  <div class="modal" id="customerModal" role="dialog" aria-modal="true" aria-labelledby="cusModalTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="cusModalTitle">Add Customer</h2>
        <button class="modalClose" id="closeCusModal" type="button" aria-label="Close">&times;</button>
      </div>

      <form id="customerForm">
        <label for="cusName">Customer name</label>
        <input type="text" id="cusName" name="name" maxlength="80" required>

        <label for="cusContact">Contact</label>
        <input type="text" id="cusContact" name="contact" placeholder="09XXXXXXXXX" maxlength="20" required>

        <label for="cusAddressSearch">Find address on map</label>
        <div class="addressSearchWrap">
          <input type="text" id="cusAddressSearch" placeholder="Type a street, building, or city..." autocomplete="off" maxlength="60">
          <div id="cusSuggestions" class="addressSuggestions" hidden></div>
        </div>

        <label for="cusStreet">Street / building</label>
        <input type="text" id="cusStreet" name="street" placeholder="e.g. 123 Shaw Blvd, Unit 4B" autocomplete="off" maxlength="100" required>

        <label for="cusCity">Town / city</label>
        <input type="text" id="cusCity" name="city" placeholder="e.g. Pasig City" autocomplete="off" maxlength="60" required>

        <label for="cusProvince">Province</label>
        <input type="text" id="cusProvince" name="province" placeholder="e.g. Metro Manila" autocomplete="off" maxlength="60" required>

        <div id="cusMap" class="customerMap" aria-label="Customer location map"></div>
        <input type="hidden" name="lat" id="cusLat">
        <input type="hidden" name="lng" id="cusLng">

        <p id="cusFormError" class="formError" role="alert" hidden></p>

        <div class="modalActions">
          <button type="submit" class="btnPrimary">Save customer</button>
          <button type="button" class="btnDanger" id="cancelCusModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>`;

export default {
  route: "customers",
  title: "Customers",
  group: "Operations",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`);
    const rows = $("customerRows");
    const rail = $("customerRail");
    const railBody = $("customerRailBody");
    const modal = $("customerModal");
    const form = $("customerForm");
    const formError = $("cusFormError");
    const mapEl = $("cusMap");
    const searchInput = $("cusAddressSearch");
    const suggestBox = $("cusSuggestions");

    let customers = [];
    let query = "";
    let selectedId = null;
    let editingId = null;
    let loading = true;
    let failure = "";
    let map = null;
    let marker = null;
    let suggestions = [];
    let searchTimer = null;
    let searchToken = 0;
    let alive = true;

    /* ---------- list ---------- */

    const matches = (customer) =>
      !query ||
      `${customer.name ?? ""} ${customer.contact ?? ""} ${customer.address ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase());

    const rowHtml = (customer) => `
      <tr data-id="${customer.id}"${selectedId === customer.id ? ' class="is-selected"' : ""}>
        <td data-card-title data-label="Customer">${esc(customer.name || "—")}</td>
        <td data-label="Contact">${esc(customer.contact || "—")}</td>
        <td data-label="Address">${esc(customer.address || "—")}</td>
        <td data-label="Deliveries">${esc(customer.deliveries ?? 0)}</td>
        <td data-label="Action">
          <div class="actionBtns">
            <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit ${esc(
              customer.name || "customer"
            )}">${ICONS.edit}</button>
            <button type="button" class="iconBtn danger" data-action="delete" title="Delete" aria-label="Delete ${esc(
              customer.name || "customer"
            )}">${ICONS.delete}</button>
          </div>
        </td>
      </tr>`;

    const railHtml = (customer) => {
      if (!customer) return `<p class="mutedText">No customer selected.</p>`;
      const pairs = [
        ["Name", customer.name || "—"],
        ["Contact", customer.contact || "—"],
        ["Address", customer.address || "—"],
        ["Deliveries", String(customer.deliveries ?? 0)],
      ];
      return `
        <div class="spaRailHead">
          <div>
            <strong>${esc(customer.name || "Customer")}</strong>
            <span>${esc(customer.contact || "No contact")}</span>
          </div>
        </div>
        <dl class="viewList">
          ${pairs
            .map(
              ([label, value]) =>
                `<div class="viewRow"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
            )
            .join("")}
        </dl>
        <div class="spaRailActions">
          <button type="button" class="btnPrimary" data-rail-action="edit">Edit</button>
          <button type="button" class="btnOutline" data-rail-action="delete">Delete</button>
        </div>`;
    };

    const syncRail = () => {
      const customer = customers.find((item) => item.id === selectedId) || null;
      railBody.innerHTML = railHtml(customer);
      rail.classList.toggle("is-open", Boolean(customer));
    };

    const render = () => {
      if (loading) {
        rows.innerHTML = `<tr><td colspan="5">${loadingState("Loading customers…")}</td></tr>`;
        return;
      }
      if (failure) {
        rows.innerHTML = `<tr><td colspan="5">${errorState(failure)}</td></tr>`;
        return;
      }
      const list = customers.filter(matches);
      $("customerCount").textContent = `${list.length} of ${customers.length}`;
      if (!list.length) {
        rows.innerHTML = `<tr><td colspan="5">${emptyState({
          title: "No customers found",
          message: customers.length
            ? "Try a different search."
            : "Add the first customer to start scheduling deliveries.",
        })}</td></tr>`;
        return;
      }
      rows.innerHTML = list.map(rowHtml).join("");
      syncRail();
    };

    const load = async ({ keepSelection = true } = {}) => {
      loading = true;
      failure = "";
      render();
      try {
        const data = await apiJson(CUS_API, { signal: ctx.signal });
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        customers = data;
        if (!keepSelection || !customers.some((item) => item.id === selectedId)) {
          selectedId = null;
        }
        loading = false;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        loading = false;
        failure = error.message || "Failed to load customers";
      }
      render();
    };

    /* ---------- map ---------- */

    const pinIcon = (L) =>
      L.divIcon({
        className: "",
        html: `<span class="customerPin" aria-hidden="true"></span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
      });

    const ensureMap = async () => {
      const L = await loadLeaflet();
      if (!alive) return null;
      if (!map) {
        map = L.map(mapEl, { scrollWheelZoom: false }).setView(MAP_CENTER, 6);
        L.tileLayer(window.mapTileUrl(), {
          maxZoom: 19,
          maxNativeZoom: window.mapMaxNativeZoom(),
          attribution: window.mapAttribution(),
          subdomains: "abcd",
        }).addTo(map);
      }
      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          /* modal closed before first paint */
        }
      });
      return L;
    };

    const setPin = async (lat, lng, pan = false) => {
      const numericLat = Number(lat);
      const numericLng = Number(lng);
      if (!Number.isFinite(numericLat) || !Number.isFinite(numericLng)) return;
      const L = await ensureMap();
      if (!L) return;

      form.elements.lat.value = numericLat.toFixed(7);
      form.elements.lng.value = numericLng.toFixed(7);

      const at = [numericLat, numericLng];
      if (!marker) {
        marker = L.marker(at, { icon: pinIcon(L), draggable: true }).addTo(map);
        marker.on("dragend", onPinDrag);
      } else {
        marker.setLatLng(at);
        marker.setIcon(pinIcon(L));
      }
      if (pan) map.setView(at, Math.max(map.getZoom(), 15));
    };

    const clearPin = () => {
      if (marker && map) map.removeLayer(marker);
      marker = null;
      form.elements.lat.value = "";
      form.elements.lng.value = "";
    };

    async function onPinDrag() {
      if (!marker) return;
      const at = marker.getLatLng();
      form.elements.lat.value = at.lat.toFixed(7);
      form.elements.lng.value = at.lng.toFixed(7);
      try {
        const res = await fetch(`api/geocode.php?reverse=1&lat=${at.lat}&lng=${at.lng}`, {
          signal: ctx.signal,
        });
        const out = await res.json();
        if (!out.ok || !out.result) return;
        const address = out.result.address || {};
        if (address.street) form.elements.street.value = address.street;
        if (address.city) form.elements.city.value = address.city;
        if (address.province) form.elements.province.value = address.province;
        if (out.result.label) searchInput.value = out.result.label;
      } catch {
        /* coordinates are still saved */
      }
    }

    /* ---------- address search ---------- */

    const hideSuggestions = () => {
      clearTimeout(searchTimer);
      searchToken += 1;
      suggestions = [];
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
    };

    const localSuggestions = (needle) => {
      const want = needle.toLowerCase();
      return customers
        .filter((customer) => customer.lat != null && customer.lng != null)
        .filter((customer) =>
          `${customer.name ?? ""} ${customer.contact ?? ""} ${customer.address ?? ""}`
            .toLowerCase()
            .includes(want)
        )
        .slice(0, 5)
        .map((customer) => ({
          label: customer.name,
          sub: customer.address || "",
          lat: Number(customer.lat),
          lng: Number(customer.lng),
          address: splitAddress(customer.address),
          kind: "Saved customer",
        }));
    };

    const renderSuggestions = (items, message = "") => {
      suggestions = items;
      if (!items.length) {
        suggestBox.innerHTML = `<div class="addressSuggestion empty">${esc(
          message || "No matching address found."
        )}</div>`;
      } else {
        suggestBox.innerHTML =
          items
            .map(
              (item, index) =>
                `<button type="button" class="addressSuggestion" data-idx="${index}">` +
                `<b>${esc(item.label)}</b>` +
                `<small>${esc(item.kind)}${item.sub ? " · " + esc(item.sub) : ""}</small>` +
                `</button>`
            )
            .join("") +
          (message ? `<div class="addressSuggestion empty">${esc(message)}</div>` : "");
      }
      suggestBox.hidden = false;
    };

    const searchRemote = async (needle, local) => {
      const token = ++searchToken;
      try {
        const res = await fetch(`api/geocode.php?q=${encodeURIComponent(needle)}`, {
          signal: ctx.signal,
        });
        const out = await res.json();
        if (token !== searchToken || !alive) return;

        if (!out.ok) {
          renderSuggestions(local, out.error || "Map search is unavailable. You can still drag the pin.");
          return;
        }

        const remote = (out.results || []).map((result) => ({
          label: result.address?.street || (result.label || "").split(",")[0],
          sub: result.label || "",
          lat: Number(result.lat),
          lng: Number(result.lng),
          address: result.address || {},
          kind: "OpenStreetMap",
        }));

        const seen = new Set();
        const merged = [...local, ...remote]
          .filter((item) => {
            const key = `${Number(item.lat).toFixed(4)},${Number(item.lng).toFixed(4)}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 8);

        renderSuggestions(merged, merged.length ? "" : "No matching address found.");
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (token === searchToken) {
          renderSuggestions(local, "Map search is unavailable. You can still drag the pin.");
        }
      }
    };

    const onAddressInput = () => {
      clearTimeout(searchTimer);
      searchToken += 1;
      const needle = searchInput.value.trim();
      if (needle.length < 2) {
        hideSuggestions();
        return;
      }
      const local = localSuggestions(needle);
      renderSuggestions(local);
      if (needle.length < 3) return;
      searchTimer = setTimeout(() => searchRemote(needle, local), 600);
    };

    searchInput.addEventListener("input", onAddressInput);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        hideSuggestions();
      }
    });

    suggestBox.addEventListener("click", (event) => {
      const button = event.target.closest(".addressSuggestion[data-idx]");
      if (!button) return;
      const item = suggestions[Number(button.dataset.idx)];
      if (!item) return;

      const address = item.address || {};
      form.elements.street.value = address.street || "";
      form.elements.city.value = address.city || "";
      form.elements.province.value = address.province || "";

      searchInput.value = item.sub || item.label;
      if (Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
        setPin(item.lat, item.lng, true);
      }
      hideSuggestions();
      if (!form.elements.street.value.trim()) form.elements.street.focus();
    });

    const onDocumentClick = (event) => {
      if (!event.target.closest(".addressSearchWrap")) hideSuggestions();
    };
    document.addEventListener("click", onDocumentClick);

    ADDR_FIELDS.forEach((field) => form.elements[field].addEventListener("input", clearPin));

    const onThemeChange = () => {
      if (marker && map && window.L) marker.setIcon(pinIcon(window.L));
    };
    const themeObserver = new MutationObserver(onThemeChange);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    /* ---------- modal ---------- */

    const clearFormError = () => {
      formError.hidden = true;
      formError.textContent = "";
      ADDR_FIELDS.forEach((field) => form.elements[field].classList.remove("fieldInvalid"));
    };

    const showFormError = (message, fields = []) => {
      formError.textContent = message;
      formError.hidden = false;
      fields.forEach((field) => form.elements[field]?.classList.add("fieldInvalid"));
      if (fields.length && form.elements[fields[0]]) form.elements[fields[0]].focus();
    };

    const openEditor = async (customer = null) => {
      editingId = customer?.id ?? null;
      $("cusModalTitle").textContent = customer ? "Edit Customer" : "Add Customer";
      form.reset();
      clearFormError();
      hideSuggestions();
      searchInput.value = "";

      if (customer) {
        form.elements.name.value = customer.name ?? "";
        form.elements.contact.value = customer.contact ?? "";
        const address = splitAddress(customer.address);
        form.elements.street.value = address.street;
        form.elements.city.value = address.city;
        form.elements.province.value = address.province;
      }

      openModal(modal, { focus: "#cusName" });

      try {
        await ensureMap();
        if (!alive) return;
        if (customer && customer.lat != null && customer.lng != null) {
          await setPin(customer.lat, customer.lng, true);
        } else {
          clearPin();
          map?.setView(MAP_CENTER, 6);
        }
      } catch (error) {
        console.error(error);
        formError.textContent = "The address map could not load. You can still save the address text.";
        formError.hidden = false;
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearFormError();

      const body = Object.fromEntries(new FormData(form));
      const missing = ADDR_FIELDS.filter((field) => !String(body[field] ?? "").trim());
      if (missing.length) {
        showFormError(
          "Please complete the address: street / building, town / city, and province.",
          missing
        );
        return;
      }

      const saveBtn = form.querySelector('button[type="submit"]');
      const label = saveBtn.textContent;
      saveBtn.disabled = true;
      saveBtn.textContent = "Checking address...";

      try {
        await apiJson(editingId ? `${CUS_API}?id=${editingId}` : CUS_API, {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctx.signal,
        });
        closeModal(modal);
        ctx.toast(editingId ? "Customer updated" : "Customer added", "success");
        await load();
      } catch (error) {
        showFormError(error.message || "Could not save the customer.", error.fields || []);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
      }
    });

    $("closeCusModal").addEventListener("click", () => closeModal(modal));
    $("cancelCusModal").addEventListener("click", () => closeModal(modal));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });

    /* ---------- actions ---------- */

    const removeCustomer = async (customer) => {
      if (!customer) return;
      const confirmed = await ctx.confirm(`Delete customer ${customer.name}?`);
      if (!confirmed) return;
      try {
        await apiJson(`${CUS_API}?id=${customer.id}`, {
          method: "DELETE",
          signal: ctx.signal,
        });
        if (selectedId === customer.id) selectedId = null;
        ctx.toast("Customer deleted", "success");
        await load();
      } catch (error) {
        ctx.toast(error.message || "Could not delete customer", "error");
      }
    };

    rows.addEventListener("click", (event) => {
      const button = event.target.closest(".iconBtn");
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      const id = Number(row.dataset.id);
      const customer = customers.find((item) => item.id === id);
      if (!customer) return;

      if (button?.dataset.action === "edit") {
        openEditor(customer);
        return;
      }
      if (button?.dataset.action === "delete") {
        removeCustomer(customer);
        return;
      }
      selectedId = selectedId === id ? null : id;
      render();
    });

    railBody.addEventListener("click", (event) => {
      const action = event.target.closest("[data-rail-action]")?.dataset.railAction;
      if (!action) return;
      const customer = customers.find((item) => item.id === selectedId);
      if (!customer) return;
      if (action === "edit") openEditor(customer);
      if (action === "delete") removeCustomer(customer);
    });

    $("customerRailClose").addEventListener("click", () => {
      selectedId = null;
      render();
    });

    ctx.setSearch({
      placeholder: "Search name, contact, or address",
      label: "Search customers",
      onInput: debounce((value) => {
        query = value;
        render();
      }, 120),
    });

    ctx.setCta({ label: "+ Add Customer", onClick: () => openEditor(null) });

    await load({ keepSelection: false });

    return () => {
      alive = false;
      clearTimeout(searchTimer);
      document.removeEventListener("click", onDocumentClick);
      themeObserver.disconnect();
      closeModal(modal);
      if (map) {
        destroyMap(map);
        map = null;
        marker = null;
      }
    };
  },
};

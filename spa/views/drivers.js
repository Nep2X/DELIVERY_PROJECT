import { apiJson } from "../api.js";
import { closeModal, emptyState, errorState, loadingState, openModal } from "../ui.js";
import { debounce, esc } from "../util.js";

const DRV_API = "api/drivers.php";
const STATUS_LIST = ["Available", "On Route", "Offline"];

const driverCode = (id) => `DRV-${String(id).padStart(4, "0")}`;

const ICONS = {
  view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
};

const options = (list, current) =>
  list
    .map(
      (value) =>
        `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(value)}</option>`
    )
    .join("");

const template = () => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Drivers</h1>
      <p>Drivers appear here automatically when a Driver account is created in Settings.</p>
    </div>
  </div>

  <div class="spaWorkspace">
    <div class="spaWorkspaceMain">
      <div class="panel">
        <div class="toolbar">
          <select id="driverStatusFilter" name="driverStatus" aria-label="Filter by driver status">
            <option value="">All statuses</option>
            ${options(STATUS_LIST, "")}
          </select>
          <button type="button" class="btnOutline" id="driverRefresh">Refresh</button>
        </div>
      </div>

      <div class="panel tablePanel">
        <div class="spaPanelHead">
          <strong>Drivers overview</strong>
          <span class="mutedText" id="driverCount">—</span>
        </div>
        <div class="tableWrapper">
          <table class="dataTable" data-mobile-cards>
            <thead>
              <tr>
                <th scope="col">Driver ID</th>
                <th scope="col">Driver</th>
                <th scope="col">Contact</th>
                <th scope="col">Deliveries</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody id="driverRows">
              <tr><td colspan="6">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="spaDetailRail" id="driverRail" aria-label="Driver details">
      <div class="spaRailHead">
        <div>
          <strong>Driver details</strong>
          <span>Select a driver to view the record</span>
        </div>
        <button type="button" class="spaRailClose" id="driverRailClose" aria-label="Close details">&times;</button>
      </div>
      <div id="driverRailBody">
        <p class="mutedText">No driver selected.</p>
      </div>
    </aside>
  </div>

  <div class="modal" id="driverModal" role="dialog" aria-modal="true" aria-labelledby="drvModalTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="drvModalTitle">Edit Driver</h2>
        <button class="modalClose" id="closeDrvModal" type="button" aria-label="Close">&times;</button>
      </div>

      <form id="driverForm">
        <label for="drvName">Driver Name</label>
        <input type="text" id="drvName" name="name" maxlength="80" required>

        <label for="drvContact">Contact</label>
        <input type="text" id="drvContact" name="contact" placeholder="09XXXXXXXXX" maxlength="20">

        <label for="drvStatus">Status</label>
        <select id="drvStatus" name="status">
          ${options(STATUS_LIST, "Available")}
        </select>

        <p class="formError" id="drvFormError" role="alert" hidden></p>

        <div class="modalActions">
          <button type="submit" class="btnPrimary">Save</button>
          <button type="button" class="btnDanger" id="cancelDrvModal">Cancel</button>
        </div>
      </form>
    </div>
  </div>`;

export default {
  route: "drivers",
  title: "Drivers",
  group: "Operations",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`);
    const rows = $("driverRows");
    const rail = $("driverRail");
    const railBody = $("driverRailBody");
    const countLabel = $("driverCount");
    const modal = $("driverModal");
    const form = $("driverForm");
    const formError = $("drvFormError");

    let drivers = [];
    let query = "";
    let selectedId = null;
    let editingId = null;
    let loading = true;
    let failure = "";

    const visible = () => {
      const status = $("driverStatusFilter")?.value || "";
      const needle = query.trim().toLowerCase();
      return drivers.filter((driver) => {
        if (status && driver.status !== status) return false;
        if (!needle) return true;
        return `${driverCode(driver.id)} ${driver.name ?? ""} ${driver.contact ?? ""}`
          .toLowerCase()
          .includes(needle);
      });
    };

    const rowHtml = (driver) => `
      <tr data-id="${driver.id}"${selectedId === driver.id ? ' class="is-selected"' : ""}>
        <td data-label="Driver ID">${driverCode(driver.id)}</td>
        <td data-card-title data-label="Driver">${esc(driver.name || "—")}</td>
        <td data-label="Contact">${esc(driver.contact || "—")}</td>
        <td data-label="Deliveries">${esc(driver.deliveries ?? 0)}</td>
        <td data-label="Status">
          <select class="inlineSel" aria-label="Driver status for ${esc(driver.name || "driver")}">
            ${options(STATUS_LIST, driver.status)}
          </select>
        </td>
        <td data-label="Action">
          <div class="actionBtns">
            <button type="button" class="iconBtn" data-action="view" title="View" aria-label="View ${esc(
              driver.name || "driver"
            )}">${ICONS.view}</button>
            <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit ${esc(
              driver.name || "driver"
            )}">${ICONS.edit}</button>
          </div>
        </td>
      </tr>`;

    const railHtml = (driver) => {
      if (!driver) {
        return `<p class="mutedText">No driver selected.</p>`;
      }
      const rowsFor = [
        ["Driver ID", driverCode(driver.id)],
        ["Name", driver.name || "—"],
        ["Contact", driver.contact || "—"],
        ["Deliveries", String(driver.deliveries ?? 0)],
        ["Status", driver.status || "—"],
      ];
      return `
        <div class="spaRailHead">
          <div>
            <strong>${esc(driver.name || driverCode(driver.id))}</strong>
            <span>${driverCode(driver.id)}</span>
          </div>
        </div>
        <dl class="viewList">
          ${rowsFor
            .map(
              ([label, value]) =>
                `<div class="viewRow"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
            )
            .join("")}
        </dl>
        <div class="spaRailActions">
          <button type="button" class="btnPrimary" data-rail-action="edit">Edit driver</button>
        </div>`;
    };

    const syncRail = () => {
      const driver = drivers.find((item) => item.id === selectedId) || null;
      railBody.innerHTML = railHtml(driver);
      rail.classList.toggle("is-open", Boolean(driver));
    };

    const render = () => {
      if (loading) {
        rows.innerHTML = `<tr><td colspan="6">${loadingState("Loading drivers…")}</td></tr>`;
        return;
      }
      if (failure) {
        rows.innerHTML = `<tr><td colspan="6">${errorState(failure)}</td></tr>`;
        return;
      }
      const list = visible();
      countLabel.textContent = `${list.length} of ${drivers.length}`;
      if (!list.length) {
        rows.innerHTML = `<tr><td colspan="6">${emptyState({
          title: "No drivers found",
          message: drivers.length ? "Try a different search or status." : "Drivers appear once a Driver account exists.",
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
        const data = await apiJson(DRV_API, { signal: ctx.signal });
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        drivers = data;
        if (!keepSelection || !drivers.some((driver) => driver.id === selectedId)) {
          selectedId = null;
        }
        loading = false;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        loading = false;
        failure = error.message || "Failed to load drivers";
      }
      render();
    };

    const openEditor = (driver) => {
      editingId = driver?.id ?? null;
      $("drvModalTitle").textContent = driver ? "Edit Driver" : "Add Driver";
      form.reset();
      formError.hidden = true;
      if (driver) {
        form.elements.name.value = driver.name ?? "";
        form.elements.contact.value = driver.contact ?? "";
        form.elements.status.value = driver.status ?? "Available";
      }
      openModal(modal, { focus: "#drvName" });
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      const url = editingId ? `${DRV_API}?id=${editingId}` : DRV_API;
      try {
        await apiJson(url, {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctx.signal,
        });
        closeModal(modal);
        ctx.toast(editingId ? "Driver updated" : "Driver saved", "success");
        await load();
      } catch (error) {
        formError.textContent = error.message || "Could not save driver";
        formError.hidden = false;
      }
    });

    $("closeDrvModal").addEventListener("click", () => closeModal(modal));
    $("cancelDrvModal").addEventListener("click", () => closeModal(modal));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });

    $("driverRailClose")?.addEventListener("click", () => {
      selectedId = null;
      render();
    });

    railBody.addEventListener("click", (event) => {
      if (event.target.closest('[data-rail-action="edit"]')) {
        const driver = drivers.find((item) => item.id === selectedId);
        if (driver) openEditor(driver);
      }
    });

    rows.addEventListener("click", (event) => {
      const button = event.target.closest(".iconBtn");
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      const id = Number(row.dataset.id);
      const driver = drivers.find((item) => item.id === id);
      if (!driver) return;

      if (button?.dataset.action === "edit") {
        openEditor(driver);
        return;
      }
      selectedId = id;
      render();
      if (button?.dataset.action === "view") {
        rail.querySelector(".spaRailHead")?.scrollIntoView({ block: "nearest" });
      }
    });

    rows.addEventListener("change", async (event) => {
      const select = event.target.closest(".inlineSel");
      if (!select) return;
      const row = select.closest("tr[data-id]");
      const id = Number(row.dataset.id);
      select.disabled = true;
      try {
        await apiJson(`${DRV_API}?id=${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: select.value }),
          signal: ctx.signal,
        });
        ctx.toast("Driver status updated", "success");
        await load();
      } catch (error) {
        ctx.toast(error.message || "Could not update status", "error");
        select.disabled = false;
        await load();
      }
    });

    const onSearch = debounce((value) => {
      query = value;
      render();
    }, 120);

    ctx.setSearch({
      placeholder: "Search driver, ID, or contact",
      label: "Search drivers",
      onInput: onSearch,
    });

    $("driverStatusFilter").addEventListener("change", render);
    $("driverRefresh").addEventListener("click", () => load());

    await load({ keepSelection: false });

    return () => {
      closeModal(modal);
    };
  },
};

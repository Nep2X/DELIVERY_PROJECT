import { apiJson } from "../api.js";
import { emptyState, errorState, loadingState } from "../ui.js";
import { debounce, esc, fmtDateTime } from "../util.js";

const EMP_API = "api/users.php";
const ROLES = ["Admin", "Employee", "Driver", "Rider"];

const empCode = (id) => `EMP-${String(id).padStart(4, "0")}`;
const activeBadge = (active) =>
  `<span class="statusBadge ${Number(active) ? "activeBadge" : "disabledBadge"}">${
    Number(active) ? "Active" : "Disabled"
  }</span>`;

const template = () => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Employees</h1>
      <p>Staff accounts across the system. Manage logins in Settings.</p>
    </div>
  </div>

  <div class="spaWorkspace">
    <div class="spaWorkspaceMain">
      <div class="panel">
        <div class="toolbar">
          <select id="employeeRole" aria-label="Filter by role">
            <option value="">All roles</option>
            ${ROLES.map((role) => `<option value="${role}">${role}</option>`).join("")}
          </select>
          <select id="employeeStatus" aria-label="Filter by status">
            <option value="">All status</option>
            <option value="Active">Active</option>
            <option value="Disabled">Disabled</option>
          </select>
          <button type="button" class="btnOutline" id="employeeRefresh">Refresh</button>
        </div>
      </div>

      <div class="panel tablePanel">
        <div class="spaPanelHead">
          <strong>Employee accounts</strong>
          <span class="mutedText" id="employeeCount">—</span>
        </div>
        <div class="tableWrapper">
          <table class="dataTable" data-mobile-cards>
            <thead>
              <tr>
                <th scope="col">Employee ID</th>
                <th scope="col">Full name</th>
                <th scope="col">Username</th>
                <th scope="col">Email</th>
                <th scope="col">Contact</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody id="employeeRows">
              <tr><td colspan="7">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="spaDetailRail" id="employeeRail" aria-label="Employee details">
      <div class="spaRailHead">
        <div>
          <strong>Employee details</strong>
          <span>Select an employee to view the record</span>
        </div>
        <button type="button" class="spaRailClose" id="employeeRailClose" aria-label="Close details">&times;</button>
      </div>
      <div id="employeeRailBody">
        <p class="mutedText">No employee selected.</p>
      </div>
    </aside>
  </div>`;

export default {
  route: "employees",
  title: "Employees",
  group: "Administration",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
    const rows = $("employeeRows");
    const rail = $("employeeRail");
    const railBody = $("employeeRailBody");
    const countLabel = $("employeeCount");

    let employees = [];
    let query = "";
    let selectedId = null;
    let loading = true;
    let failure = "";

    const matches = (employee) => {
      const role = $("employeeRole")?.value || "";
      const status = $("employeeStatus")?.value || "";
      if (role && employee.role !== role) return false;
      if (status) {
        const active = Number(employee.is_active) === 1;
        if (status === "Active" && !active) return false;
        if (status === "Disabled" && active) return false;
      }
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return [
        employee.id,
        employee.full_name,
        employee.username,
        employee.email,
        employee.contact_number,
        employee.role,
        employee.driver_name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    };

    const rowHtml = (employee) => `
      <tr data-id="${employee.id}"${selectedId === employee.id ? ' class="is-selected"' : ""}>
        <td data-label="Employee ID">${empCode(employee.id)}</td>
        <td data-card-title data-label="Full name">${esc(employee.full_name || "—")}</td>
        <td data-label="Username">${esc(employee.username || "—")}</td>
        <td data-label="Email">${esc(employee.email || "—")}</td>
        <td data-label="Contact">${esc(employee.contact_number || "—")}</td>
        <td data-label="Role"><span class="statusBadge">${esc(employee.role || "—")}</span></td>
        <td data-label="Status">${activeBadge(employee.is_active)}</td>
      </tr>`;

    const railHtml = (employee) => {
      if (!employee) return `<p class="mutedText">No employee selected.</p>`;
      const pairs = [
        ["Employee ID", empCode(employee.id)],
        ["Full name", employee.full_name || "—"],
        ["Username", employee.username || "—"],
        ["Email", employee.email || "—"],
        ["Contact", employee.contact_number || "—"],
        ["Role", employee.role || "—"],
        ["Status", Number(employee.is_active) ? "Active" : "Disabled"],
        ["Last login", employee.last_login ? fmtDateTime(employee.last_login) : "Never"],
        ["Linked driver", employee.driver_name || "—"],
      ];
      return `
        <div class="spaRailHead">
          <div>
            <strong>${esc(employee.full_name || empCode(employee.id))}</strong>
            <span>${empCode(employee.id)}</span>
          </div>
        </div>
        <dl class="viewList">
          ${pairs
            .map(
              ([label, value]) =>
                `<div class="viewRow"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`
            )
            .join("")}
        </dl>`;
    };

    const syncRail = () => {
      const employee = employees.find((item) => item.id === selectedId) || null;
      railBody.innerHTML = railHtml(employee);
      rail.classList.toggle("is-open", Boolean(employee));
    };

    const render = () => {
      if (loading) {
        rows.innerHTML = `<tr><td colspan="7">${loadingState("Loading employees…")}</td></tr>`;
        return;
      }
      if (failure) {
        rows.innerHTML = `<tr><td colspan="7">${errorState(failure)}</td></tr>`;
        return;
      }
      const list = employees.filter(matches);
      countLabel.textContent = `${list.length} of ${employees.length}`;
      if (!list.length) {
        rows.innerHTML = `<tr><td colspan="7">${emptyState({
          title: "No employees found",
          message: employees.length
            ? "Try a different search, role, or status."
            : "No staff accounts yet.",
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
        const data = await apiJson(EMP_API, { signal: ctx.signal });
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        employees = data;
        if (!keepSelection || !employees.some((item) => item.id === selectedId)) {
          selectedId = null;
        }
        loading = false;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        loading = false;
        failure = error.message || "Failed to load employees";
      }
      render();
    };

    rows.addEventListener("click", (event) => {
      const row = event.target.closest("tr[data-id]");
      if (!row) return;
      const id = Number(row.dataset.id);
      selectedId = selectedId === id ? null : id;
      render();
      if (selectedId !== null) {
        rail.querySelector(".spaRailHead")?.scrollIntoView({ block: "nearest" });
      }
    });

    $("employeeRailClose").addEventListener("click", () => {
      selectedId = null;
      render();
    });

    ctx.setSearch({
      placeholder: "Search name, username, email, or ID",
      label: "Search employees",
      onInput: debounce((value) => {
        query = value;
        render();
      }, 120),
    });

    $("employeeRole").addEventListener("change", render);
    $("employeeStatus").addEventListener("change", render);
    $("employeeRefresh").addEventListener("click", () => load());

    await load({ keepSelection: false });

    return () => {};
  },
};

import { apiJson } from "../api.js";
import { renderThemePicker } from "../theme-picker.js";
import { closeModal, emptyState, errorState, loadingState, openModal } from "../ui.js";
import { debounce, esc, fmtDateTime } from "../util.js";

const AUTH_API = "api/auth.php";
const USERS_API = "api/users.php";
const ROLES = ["Employee", "Admin", "Driver", "Rider"];

const driverCode = (id) => `DRV-${String(id).padStart(4, "0")}`;

const ICONS = {
  edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
  key: `<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2"/><path d="M17 6l3 3"/></svg>`,
  delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const statusBadgeFor = (active) =>
  `<span class="statusBadge ${Number(active) ? "deliveredBadge" : "pendingBadge"}">${
    Number(active) ? "Active" : "Disabled"
  }</span>`;

const template = (isAdmin) => `
  <div class="spaViewHead">
    <div>
      <h1 tabindex="-1">Settings</h1>
      <p>Your profile, password, and appearance${isAdmin ? ", plus the accounts that can sign in." : "."}</p>
    </div>
  </div>

  <div class="settingsGrid">
    <div class="profileCard">
      <h2>Profile</h2>
      <div class="profileRow"><span>Name</span><strong id="pName">-</strong></div>
      <div class="profileRow"><span>Username</span><strong id="pUsername">-</strong></div>
      <div class="profileRow"><span>Email</span><strong id="pEmail">-</strong></div>
      <div class="profileRow"><span>Role</span><strong id="pRole">-</strong></div>
      <button class="btnPrimary" type="button" id="editProfileBtn">Edit Profile</button>
    </div>

    <div class="profileCard">
      <h2>Security</h2>
      <div class="profileRow"><span>Password</span><strong>********</strong></div>
      <div class="profileRow"><span>Last login</span><strong id="pLastLogin">-</strong></div>
      <button class="btnOutline" type="button" id="changePwBtn">Change Password</button>
    </div>

    <div class="profileCard">
      <h2>Appearance</h2>
      <div class="profileRow"><span>Theme Color</span><div id="themeSlot"></div></div>
    </div>
  </div>

  ${
    isAdmin
      ? `<div class="spaWorkspace">
    <div class="spaWorkspaceMain">
      <div class="panel tablePanel">
        <div class="spaPanelHead">
          <strong>User accounts</strong>
          <span class="mutedText" id="userCount">—</span>
        </div>
        <div class="tableWrapper">
          <table class="dataTable" data-mobile-cards>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Contact</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody id="userRows">
              <tr><td colspan="6">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <aside class="spaDetailRail" id="userRail" aria-label="Account details">
      <div class="spaRailHead">
        <div>
          <strong>Account details</strong>
          <span>Select an account to view the record</span>
        </div>
        <button type="button" class="spaRailClose" id="userRailClose" aria-label="Close details">&times;</button>
      </div>
      <div id="userRailBody">
        <p class="mutedText">No account selected.</p>
      </div>
    </aside>
  </div>`
      : ""
  }

  <div class="modal" id="profileModal" role="dialog" aria-modal="true" aria-label="Edit Profile">
    <div class="modalBox">
      <div class="modalHeader">
        <h2>Edit Profile</h2>
        <button class="modalClose" type="button" data-close aria-label="Close">&times;</button>
      </div>
      <form id="profileForm">
        <label for="profName">Full Name</label>
        <input type="text" id="profName" name="full_name" maxlength="80" required>
        <label for="profEmail">Email</label>
        <input type="email" id="profEmail" name="email" maxlength="120">
        <p class="formError" id="profileError" role="alert" hidden></p>
        <div class="modalActions">
          <button type="submit" class="btnPrimary">Save</button>
          <button type="button" class="btnDanger" data-close>Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal" id="passwordModal" role="dialog" aria-modal="true" aria-label="Change Password">
    <div class="modalBox">
      <div class="modalHeader">
        <h2>Change Password</h2>
        <button class="modalClose" type="button" data-close aria-label="Close">&times;</button>
      </div>
      <form id="passwordForm">
        <label for="curPw">Current Password</label>
        <input type="password" id="curPw" autocomplete="current-password" maxlength="72" required>
        <label for="newPw">New Password (8-72 characters)</label>
        <input type="password" id="newPw" autocomplete="new-password" minlength="8" maxlength="72" required>
        <label for="confPw">Confirm New Password</label>
        <input type="password" id="confPw" autocomplete="new-password" maxlength="72" required>
        <p class="formError" id="passwordError" role="alert" hidden></p>
        <div class="modalActions">
          <button type="submit" class="btnPrimary">Update password</button>
          <button type="button" class="btnDanger" data-close>Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal" id="userModal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="userModalTitle">Add User</h2>
        <button class="modalClose" type="button" data-close aria-label="Close">&times;</button>
      </div>
      <form id="userForm">
        <label for="uUsername">Username</label>
        <input type="text" id="uUsername" name="username" autocomplete="off" minlength="3" maxlength="30" required>

        <div id="uPasswordGroup">
          <label for="uPassword">Password</label>
          <input type="password" id="uPassword" name="password" minlength="8" maxlength="72" autocomplete="new-password">
        </div>

        <label for="uName">Full Name</label>
        <input type="text" id="uName" name="full_name" maxlength="80" required>
        <label for="uEmail">Email</label>
        <input type="email" id="uEmail" name="email" maxlength="120">
        <label for="uRole">Role</label>
        <select id="uRole" name="role" required>
          ${ROLES.map((role) => `<option value="${role}">${role}</option>`).join("")}
        </select>
        <label for="uContact">Contact Number</label>
        <input type="tel" id="uContact" name="contact_number" placeholder="09XXXXXXXXX" maxlength="20">

        <div id="uActiveGroup">
          <label for="uActive">Status</label>
          <select id="uActive" name="is_active">
            <option value="1">Active</option>
            <option value="0">Disabled</option>
          </select>
        </div>

        <p class="formError" id="userError" role="alert" hidden></p>

        <div class="modalActions">
          <button type="submit" class="btnPrimary">Save</button>
          <button type="button" class="btnDanger" data-close>Cancel</button>
        </div>
      </form>
    </div>
  </div>

  <div class="modal" id="resetModal" role="dialog" aria-modal="true" aria-labelledby="resetTitle">
    <div class="modalBox">
      <div class="modalHeader">
        <h2 id="resetTitle">Reset Password</h2>
        <button class="modalClose" type="button" data-close aria-label="Close">&times;</button>
      </div>
      <form id="resetForm">
        <label for="resetPw">New Password (8-72 characters)</label>
        <input type="password" id="resetPw" autocomplete="new-password" minlength="8" maxlength="72" required>
        <p class="formError" id="resetError" role="alert" hidden></p>
        <div class="modalActions">
          <button type="submit" class="btnPrimary">Reset password</button>
          <button type="button" class="btnDanger" data-close>Cancel</button>
        </div>
      </form>
    </div>
  </div>`;

export default {
  route: "settings",
  title: "Settings",
  group: "Administration",

  async mount(root, ctx) {
    const isAdmin = ctx.user?.role === "Admin";
    root.innerHTML = template(isAdmin);

    const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
    const modals = ["profileModal", "passwordModal", "userModal", "resetModal"]
      .map((id) => $(id))
      .filter(Boolean);

    let me = null;
    let users = [];
    let query = "";
    let selectedId = null;
    let editingUserId = null;
    let resetUserId = null;
    let alive = true;

    const showError = (el, message) => {
      if (!el) return;
      el.textContent = message;
      el.hidden = false;
    };
    const hideError = (el) => {
      if (!el) return;
      el.textContent = "";
      el.hidden = true;
    };

    /* ---------- profile ---------- */

    const loadProfile = async () => {
      const data = await apiJson(`${AUTH_API}?action=me`, { signal: ctx.signal });
      if (!alive) return;
      me = data.user || {};
      $("pName").textContent = me.full_name || "-";
      $("pUsername").textContent = me.username || "-";
      $("pEmail").textContent = me.email || "-";
      $("pRole").textContent = me.role || "-";
      $("pLastLogin").textContent = me.last_login ? fmtDateTime(me.last_login) : "Never";
    };

    $("editProfileBtn").addEventListener("click", () => {
      $("profName").value = me?.full_name ?? "";
      $("profEmail").value = me?.email ?? "";
      hideError($("profileError"));
      openModal($("profileModal"), { focus: "#profName" });
    });

    $("profileForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      hideError($("profileError"));
      try {
        await apiJson(`${AUTH_API}?action=update_profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: $("profName").value.trim(),
            email: $("profEmail").value.trim(),
          }),
          signal: ctx.signal,
        });
        closeModal($("profileModal"));
        ctx.toast("Profile updated", "success");
        await loadProfile();
        if (isAdmin) await loadUsers();
      } catch (error) {
        showError($("profileError"), error.message || "Could not save profile");
      }
    });

    $("changePwBtn").addEventListener("click", () => {
      $("passwordForm").reset();
      hideError($("passwordError"));
      openModal($("passwordModal"), { focus: "#curPw" });
    });

    $("passwordForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      hideError($("passwordError"));
      if ($("newPw").value !== $("confPw").value) {
        showError($("passwordError"), "The new passwords do not match.");
        return;
      }
      try {
        await apiJson(`${AUTH_API}?action=change_password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current: $("curPw").value, new: $("newPw").value }),
          signal: ctx.signal,
        });
        closeModal($("passwordModal"));
        ctx.toast("Password updated", "success");
      } catch (error) {
        showError($("passwordError"), error.message || "Could not change password");
      }
    });

    renderThemePicker($("themeSlot"));

    /* ---------- user accounts (Admin only) ---------- */

    const rail = $("userRail");
    const railBody = $("userRailBody");

    const matches = (user) =>
      !query ||
      [user.full_name, user.username, user.role, user.email, user.contact_number]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase());

    const rowHtml = (user) => `
      <tr data-id="${user.id}"${selectedId === user.id ? ' class="is-selected"' : ""}>
        <td data-card-title data-label="Name">${esc(user.full_name || "—")}</td>
        <td data-label="Username">${esc(user.username || "—")}</td>
        <td data-label="Role">${esc(user.role || "—")}${
          user.driver_id ? ` &middot; ${driverCode(user.driver_id)}` : ""
        }</td>
        <td data-label="Contact">${esc(user.contact_number || "—")}</td>
        <td data-label="Status">${statusBadgeFor(user.is_active)}</td>
        <td data-label="Action">
          <div class="actionBtns">
            <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit ${esc(
              user.username || "user"
            )}">${ICONS.edit}</button>
            <button type="button" class="iconBtn" data-action="reset" title="Reset password" aria-label="Reset password for ${esc(
              user.username || "user"
            )}">${ICONS.key}</button>
            <button type="button" class="iconBtn danger" data-action="delete" title="Delete" aria-label="Delete ${esc(
              user.username || "user"
            )}">${ICONS.delete}</button>
          </div>
        </td>
      </tr>`;

    const railHtml = (user) => {
      if (!user) return `<p class="mutedText">No account selected.</p>`;
      const pairs = [
        ["Name", user.full_name || "—"],
        ["Username", user.username || "—"],
        ["Email", user.email || "—"],
        ["Contact", user.contact_number || "—"],
        ["Role", user.role || "—"],
        ["Status", Number(user.is_active) ? "Active" : "Disabled"],
        ["Last login", user.last_login ? fmtDateTime(user.last_login) : "Never"],
        ["Linked driver", user.driver_name || (user.driver_id ? driverCode(user.driver_id) : "—")],
      ];
      return `
        <div class="spaRailHead">
          <div>
            <strong>${esc(user.full_name || user.username || "Account")}</strong>
            <span>${esc(user.username || "")}</span>
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
          <button type="button" class="btnOutline" data-rail-action="reset">Reset password</button>
          <button type="button" class="btnOutline" data-rail-action="delete">Delete</button>
        </div>`;
    };

    const syncRail = () => {
      if (!rail) return;
      const user = users.find((item) => item.id === selectedId) || null;
      railBody.innerHTML = railHtml(user);
      rail.classList.toggle("is-open", Boolean(user));
    };

    const renderUsers = () => {
      const rows = $("userRows");
      if (!rows) return;
      const list = users.filter(matches);
      $("userCount").textContent = `${list.length} of ${users.length}`;
      if (!list.length) {
        rows.innerHTML = `<tr><td colspan="6">${emptyState({
          title: "No accounts found",
          message: users.length ? "Try a different search." : "Add the first account.",
        })}</td></tr>`;
        return;
      }
      rows.innerHTML = list.map(rowHtml).join("");
      syncRail();
    };

    const loadUsers = async ({ keepSelection = true } = {}) => {
      const rows = $("userRows");
      if (!rows) return;
      rows.innerHTML = `<tr><td colspan="6">${loadingState("Loading accounts…")}</td></tr>`;
      try {
        const data = await apiJson(USERS_API, { signal: ctx.signal });
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        users = data;
        if (!keepSelection || !users.some((item) => item.id === selectedId)) {
          selectedId = null;
        }
        renderUsers();
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.error(error);
        rows.innerHTML = `<tr><td colspan="6">${errorState(
          error.message || "Failed to load accounts"
        )}</td></tr>`;
      }
    };

    const openUserModal = (user = null) => {
      editingUserId = user?.id ?? null;
      $("userModalTitle").textContent = user ? "Edit User" : "Add User";
      $("userForm").reset();
      hideError($("userError"));
      $("uUsername").readOnly = Boolean(user);
      $("uPasswordGroup").style.display = user ? "none" : "block";
      $("uActiveGroup").style.display = user ? "block" : "none";
      $("uPassword").required = !user;

      if (user) {
        $("uUsername").value = user.username ?? "";
        $("uName").value = user.full_name ?? "";
        $("uEmail").value = user.email ?? "";
        $("uRole").value = user.role ?? "Employee";
        $("uContact").value = user.contact_number ?? "";
        $("uActive").value = Number(user.is_active) ? "1" : "0";
      } else {
        $("uRole").value = "Employee";
      }

      openModal($("userModal"), { focus: user ? "#uName" : "#uUsername" });
    };

    const openResetModal = (user) => {
      resetUserId = user.id;
      $("resetTitle").textContent = `Reset password: ${user.username}`;
      $("resetForm").reset();
      hideError($("resetError"));
      openModal($("resetModal"), { focus: "#resetPw" });
    };

    const removeUser = async (user) => {
      const confirmed = await ctx.confirm(`Delete the account “${user.username}”?`);
      if (!confirmed) return;
      try {
        await apiJson(`${USERS_API}?id=${user.id}`, { method: "DELETE", signal: ctx.signal });
        if (selectedId === user.id) selectedId = null;
        ctx.toast("Account deleted", "success");
        await loadUsers();
      } catch (error) {
        ctx.toast(error.message || "Could not delete account", "error");
      }
    };

    if (isAdmin) {
      $("userForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        hideError($("userError"));

        const body = {
          full_name: $("uName").value.trim(),
          email: $("uEmail").value.trim(),
          role: $("uRole").value,
          contact_number: $("uContact").value.trim(),
        };

        try {
          if (editingUserId) {
            body.is_active = $("uActive").value === "1";
            await apiJson(`${USERS_API}?id=${editingUserId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: ctx.signal,
            });
          } else {
            body.username = $("uUsername").value.trim();
            body.password = $("uPassword").value;
            await apiJson(USERS_API, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: ctx.signal,
            });
          }
          closeModal($("userModal"));
          ctx.toast(editingUserId ? "Account updated" : "Account created", "success");
          await loadUsers();
        } catch (error) {
          showError($("userError"), error.message || "Could not save account");
        }
      });

      $("resetForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        hideError($("resetError"));
        try {
          await apiJson(`${USERS_API}?id=${resetUserId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: $("resetPw").value }),
            signal: ctx.signal,
          });
          closeModal($("resetModal"));
          ctx.toast("Password has been reset", "success");
        } catch (error) {
          showError($("resetError"), error.message || "Could not reset password");
        }
      });

      $("userRows").addEventListener("click", (event) => {
        const button = event.target.closest(".iconBtn");
        const row = event.target.closest("tr[data-id]");
        if (!row) return;
        const user = users.find((item) => String(item.id) === row.dataset.id);
        if (!user) return;

        if (button?.dataset.action === "edit") {
          openUserModal(user);
          return;
        }
        if (button?.dataset.action === "reset") {
          openResetModal(user);
          return;
        }
        if (button?.dataset.action === "delete") {
          removeUser(user);
          return;
        }
        selectedId = selectedId === user.id ? null : user.id;
        renderUsers();
      });

      railBody.addEventListener("click", (event) => {
        const action = event.target.closest("[data-rail-action]")?.dataset.railAction;
        if (!action) return;
        const user = users.find((item) => item.id === selectedId);
        if (!user) return;
        if (action === "edit") openUserModal(user);
        if (action === "reset") openResetModal(user);
        if (action === "delete") removeUser(user);
      });

      $("userRailClose").addEventListener("click", () => {
        selectedId = null;
        renderUsers();
      });

      ctx.setSearch({
        placeholder: "Search accounts",
        label: "Search user accounts",
        onInput: debounce((value) => {
          query = value;
          renderUsers();
        }, 120),
      });

      ctx.setCta({ label: "+ Add User", onClick: () => openUserModal() });
    }

    modals.forEach((modal) => {
      modal.querySelectorAll("[data-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(modal));
      });
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal);
      });
    });

    try {
      await loadProfile();
      if (isAdmin) await loadUsers({ keepSelection: false });
    } catch (error) {
      if (error?.name !== "AbortError") console.error(error);
    }

    return () => {
      alive = false;
      modals.forEach((modal) => closeModal(modal));
    };
  },
};

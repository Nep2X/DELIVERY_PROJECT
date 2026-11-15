import { esc } from "./util.js";

const BADGE_CLASS = {
  Pending: "pendingBadge",
  Processing: "processingBadge",
  "Out for Delivery": "outBadge",
  Delivered: "deliveredBadge",
  Cancelled: "cancelledBadge",
};

export const statusBadge = (status) => {
  const value = String(status ?? "");
  const variant = BADGE_CLASS[value];
  const cls = variant ? `statusBadge ${variant}` : "statusBadge";
  return `<span class="${cls}">${esc(value)}</span>`;
};

export const statusChip = ({ label, value, active = false }) => {
  const text = label ?? value ?? "";
  return `<button type="button" class="spaChip" data-value="${esc(value ?? text)}" aria-pressed="${
    active ? "true" : "false"
  }">${esc(text)}</button>`;
};

export const emptyState = ({ title, message, actionLabel, actionAttrs = "" }) => {
  const action = actionLabel
    ? `<button type="button" class="btnPrimary" ${actionAttrs}>${esc(actionLabel)}</button>`
    : "";
  return `<div class="spaEmpty"><strong>${esc(title)}</strong><p>${esc(message)}</p>${action}</div>`;
};

export const loadingState = (message = "Loading…") =>
  `<div class="spaLoading" role="status">${esc(message)}</div>`;

export const errorState = (message) =>
  `<div class="spaError" role="alert"><strong>Something went wrong</strong><p>${esc(
    message || "Please try again."
  )}</p></div>`;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visibleDialogs = () =>
  [...document.querySelectorAll('[aria-modal="true"]')].filter(
    (node) => node.style.display !== "none" && !node.hidden
  );

const focusablesIn = (node) =>
  [...node.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );

export function openModal(modal, options = {}) {
  if (!modal) return;
  modal._spaOpener = document.activeElement;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal.hidden = false;
  modal.style.display = "flex";
  modal.removeAttribute("aria-hidden");

  const preferred = options.focus ? modal.querySelector(options.focus) : null;
  const target =
    preferred || modal.querySelector("[data-autofocus]") || focusablesIn(modal)[0] || modal;
  if (target === modal && !modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
}

export function closeModal(modal) {
  if (!modal || modal.style.display === "none") return;
  modal.style.display = "none";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  const opener = modal._spaOpener;
  if (opener && document.contains(opener) && typeof opener.focus === "function") {
    opener.focus({ preventScroll: true });
  }
  modal._spaOpener = null;
}

export function initModalTrap() {
  const onKeydown = (event) => {
    const dialogs = visibleDialogs();
    if (!dialogs.length) return;
    const top = dialogs[dialogs.length - 1];

    if (event.key === "Escape") {
      event.preventDefault();
      closeModal(top);
      top.dispatchEvent(new CustomEvent("modalclose", { bubbles: true }));
      return;
    }

    if (event.key !== "Tab") return;
    const items = focusablesIn(top);
    if (!items.length) {
      event.preventDefault();
      top.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !top.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !top.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener("keydown", onKeydown);
  return () => document.removeEventListener("keydown", onKeydown);
}

export function toast(message, type) {
  const text = String(message ?? "");
  let level = type;
  if (!level) {
    level = /^error|failed|cannot|invalid|not match/i.test(text)
      ? "error"
      : /updated|saved|reset|deleted|created|success/i.test(text)
        ? "success"
        : "info";
  }

  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }

  const node = document.createElement("div");
  node.className = `toast ${level}${text.includes("\n") ? " detail" : ""}`;
  node.setAttribute("role", level === "error" ? "alert" : "status");

  const msg = document.createElement("div");
  msg.className = "toastMsg";
  msg.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toastClose";
  close.setAttribute("aria-label", "Close");
  close.textContent = "\u00d7";

  const remove = () => node.remove();
  close.addEventListener("click", remove);
  node.append(msg, close);
  host.appendChild(node);

  if (!text.includes("\n")) setTimeout(remove, level === "error" ? 7000 : 4000);
}

export function confirmBox(message) {
  return new Promise((resolve) => {
    const text = String(message ?? "");
    const danger = /^delete/i.test(text);
    const overlay = document.createElement("div");
    overlay.className = "confirmOverlay";
    overlay.innerHTML = `
      <div class="confirmBox" role="dialog" aria-modal="true" aria-label="Confirm action">
        <p class="confirmText"></p>
        <div class="confirmActions">
          <button type="button" class="btnOutline" data-answer="no">Cancel</button>
          <button type="button" class="${danger ? "btnDanger" : "btnPrimary"}" data-answer="yes">${
            danger ? "Delete" : "Confirm"
          }</button>
        </div>
      </div>`;
    overlay.querySelector(".confirmText").textContent = text;

    const opener = document.activeElement;
    const finish = (answer) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (opener && document.contains(opener) && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.key === "Escape") finish(false);
    };

    overlay.addEventListener("click", (event) => {
      const button = event.target.closest("[data-answer]");
      if (button) {
        finish(button.dataset.answer === "yes");
        return;
      }
      if (event.target === overlay) finish(false);
    });

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-answer="no"]').focus();
  });
}

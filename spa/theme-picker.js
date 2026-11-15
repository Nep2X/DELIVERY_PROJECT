export function renderThemePicker(slot) {
  if (!slot || typeof window.renderThemePicker !== "function") return;
  window.renderThemePicker(slot);
}

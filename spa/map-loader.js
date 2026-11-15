let leafletPromise = null;

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const injectCss = (href, id) => {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
};

const injectScript = (src, id) =>
  new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Map unavailable")), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error("Map unavailable")), { once: true });
    document.head.appendChild(script);
  });

export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  injectCss(LEAFLET_CSS, "spaLeafletCss");
  leafletPromise = injectScript(LEAFLET_JS, "spaLeafletJs")
    .then(() => {
      if (!window.L) throw new Error("Map unavailable");
      return window.L;
    })
    .catch((error) => {
      leafletPromise = null;
      throw error;
    });

  return leafletPromise;
}

export function destroyMap(map) {
  if (!map) return;
  try {
    if (typeof map.remove === "function") map.remove();
  } catch {
    /* map already detached */
  }
}

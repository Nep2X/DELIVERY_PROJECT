// Shared map chrome: the same basemap + style picker + zoom/scale controls
// everywhere a map appears, so Live Map and Deliveries look identical.

const TOPO_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const TOPO_ATTRIBUTION =
  '&copy; <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; OpenMapTiles &copy; OpenStreetMap contributors';

const FALLBACK_STYLES = {
  street: { label: "Street" },
  topo: { label: "Topo" },
  imagery: { label: "Satellite" },
};

export const mapStyleOptions = () => {
  try {
    return typeof MAP_STYLES !== "undefined" && MAP_STYLES ? MAP_STYLES : FALLBACK_STYLES;
  } catch {
    return FALLBACK_STYLES;
  }
};

export const currentMapStyle = () => {
  try {
    return typeof mapStyleName === "function" ? mapStyleName() : "topo";
  } catch {
    return "topo";
  }
};

const storageKey = () => {
  try {
    return typeof MAP_STYLE_KEY === "string" ? MAP_STYLE_KEY : "mapStyle";
  } catch {
    return "mapStyle";
  }
};

export const tileUrlFor = (style) =>
  typeof window.mapTileUrl === "function"
    ? window.mapTileUrl(style)
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const tileAttributionFor = (style) =>
  typeof window.mapAttribution === "function" ? window.mapAttribution(style) : "&copy; OpenStreetMap";

export const tileMaxNativeZoomFor = (style) =>
  typeof window.mapMaxNativeZoom === "function" ? window.mapMaxNativeZoom(style) : 19;

/* ---------- vector topo style (same palette as the legacy page) ---------- */

const patchTopoStyle = (style) => {
  const byId = {};
  style.layers.forEach((layer) => {
    byId[layer.id] = layer;
  });
  const set = (id, paint) => {
    const layer = byId[id];
    if (layer) layer.paint = Object.assign({}, layer.paint, paint);
  };
  const lay = (id, props) => {
    const layer = byId[id];
    if (layer) layer.layout = Object.assign({}, layer.layout, props);
  };

  set("background", { "background-color": "#F6F2E9" });
  set("park", { "fill-color": "#D9E6C4" });
  set("water", { "fill-color": "#BFE3F2" });
  set("waterway", { "line-color": "#BFE3F2" });
  set("landuse_residential", { "fill-color": "#F1ECE1", "fill-opacity": 0.45 });
  set("landcover_wood", { "fill-color": "#CFE0B8" });

  set("highway_path", { "line-color": "#EFEBE1" });
  set("highway_minor", { "line-color": "#FFFFFF" });
  set("highway_major_casing", { "line-color": "#CFCABF" });
  set("highway_major_inner", { "line-color": "#FFFFFF" });
  set("highway_motorway_casing", { "line-color": "#BDB7AB" });
  set("highway_motorway_inner", { "line-color": "#DDD8CD" });

  const minorIndex = style.layers.findIndex((layer) => layer.id === "highway_minor");
  if (minorIndex >= 0) {
    style.layers.splice(minorIndex, 0, {
      id: "highway_minor_casing",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 9,
      filter: [
        "all",
        ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
        ["match", ["get", "brunnel"], ["bridge", "tunnel"], false, true],
        ["match", ["get", "class"], ["minor", "service", "track"], true, false],
      ],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#E0DBD0",
        "line-width": ["interpolate", ["exponential", 1.55], ["zoom"], 13, 3.2, 20, 21.5],
      },
    });
  }

  set("boundary_3", { "line-color": "#C9C5BC" });
  set("boundary_2", { "line-color": "#C9C5BC" });

  if (byId.building) {
    byId.building.layout = Object.assign({}, byId.building.layout, { visibility: "none" });
  }

  style.layers = style.layers.filter((layer) => !/shield/i.test(layer.id));

  [
    "label_other",
    "label_town",
    "label_city",
    "label_state",
    "label_country_1",
    "label_country_2",
    "label_country_3",
  ].forEach((id) => {
    set(id, {
      "text-color": "#3A3A3A",
      "text-halo-color": "#FFFFFF",
      "text-halo-width": 1.2,
      "text-halo-blur": 0,
    });
    const layer = byId[id];
    if (layer && layer.layout) {
      delete layer.layout["icon-image"];
      delete layer.layout["icon-optional"];
      delete layer.layout["icon-size"];
      delete layer.layout["icon-allow-overlap"];
    }
  });
  set("label_city", { "text-color": "#1F1F1F" });
  lay("label_city", { "text-font": ["Noto Sans Bold"] });
  set("label_town", { "text-color": "#2E2E2E" });
  lay("label_town", { "text-font": ["Noto Sans Bold"] });
  set("label_other", { "text-color": "#6A6A6A", "text-halo-width": 1 });
  lay("label_other", { "text-transform": "none" });

  ["highway-name-minor", "highway-name-major"].forEach((id) => {
    set(id, {
      "text-color": "#4F4F4F",
      "text-halo-color": "#FFFFFF",
      "text-halo-width": 1,
      "text-halo-blur": 0,
    });
  });
  ["water_name_point_label", "water_name_line_label"].forEach((id) => {
    set(id, { "text-color": "#5B7C93", "text-halo-color": "#FFFFFF" });
  });
  if (byId.airport && byId.airport.layout) {
    delete byId.airport.layout["icon-image"];
    delete byId.airport.layout["icon-size"];
  }

  return style;
};

let topoStylePromise = null;

const loadTopoStyle = () => {
  if (topoStylePromise) return topoStylePromise;
  topoStylePromise = fetch(TOPO_STYLE_URL)
    .then((response) => response.json())
    .then((json) => patchTopoStyle(json))
    .catch((error) => {
      topoStylePromise = null;
      throw error;
    });
  return topoStylePromise;
};

/* ---------- style controller ---------- */

export function createMapStyleController(L, map, root, { isAlive = () => true } = {}) {
  let tileLayer = null;
  let topoLayer = null;
  let topoAttribution = null;
  let token = 0;
  let style = null;

  const syncButtons = (name) => {
    root.querySelectorAll(".mapStylePicker button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.style === name));
    });
  };

  const removeTopo = () => {
    if (topoLayer) {
      map.removeLayer(topoLayer);
      topoLayer = null;
    }
    if (topoAttribution) {
      map.attributionControl.removeAttribution(topoAttribution);
      topoAttribution = null;
    }
  };

  const addRaster = (name) => {
    tileLayer = L.tileLayer(tileUrlFor(name), {
      maxZoom: 19,
      maxNativeZoom: tileMaxNativeZoomFor(name),
      attribution: tileAttributionFor(name),
      subdomains: "abcd",
    }).addTo(map);
    tileLayer.bringToBack();
    document.documentElement.setAttribute("data-map-style", name);
    syncButtons(name);
  };

  const apply = (name) => {
    if (!map) return;
    style = name;
    const current = ++token;
    removeTopo();
    if (tileLayer) {
      map.removeLayer(tileLayer);
      tileLayer = null;
    }

    if (name === "topo" && typeof L.maplibreGL === "function") {
      loadTopoStyle()
        .then((patched) => {
          if (current !== token || !map || !isAlive()) return;
          topoLayer = L.maplibreGL({
            style: patched,
            attributionControl: { customAttribution: TOPO_ATTRIBUTION },
          }).addTo(map);
          topoAttribution = TOPO_ATTRIBUTION;
          document.documentElement.setAttribute("data-map-style", name);
          syncButtons(name);
        })
        .catch(() => {
          if (current !== token || !map || !isAlive()) return;
          addRaster(name);
        });
      return;
    }

    addRaster(name);
  };

  return { apply, current: () => style };
}

/* ---------- controls ---------- */

export function setupMapChrome(L, map, root, options = {}) {
  const controller = createMapStyleController(L, map, root, options);

  const StyleControl = L.Control.extend({
    options: { position: "bottomright" },
    onAdd() {
      const box = L.DomUtil.create("div", "mapStylePicker");
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", "Map style");
      Object.entries(mapStyleOptions()).forEach(([key, entry]) => {
        const button = L.DomUtil.create("button", "", box);
        button.type = "button";
        button.dataset.style = key;
        button.textContent = entry.label;
        button.setAttribute("aria-pressed", String(key === currentMapStyle()));
        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.stop(event);
          try {
            localStorage.setItem(storageKey(), key);
          } catch {
            /* storage blocked */
          }
          controller.apply(key);
        });
      });
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    },
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  new StyleControl().addTo(map);
  L.control.scale({ position: "bottomright", imperial: false, maxWidth: 120 }).addTo(map);

  controller.apply(currentMapStyle());
  return controller;
}

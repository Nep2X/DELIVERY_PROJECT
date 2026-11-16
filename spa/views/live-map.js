import { apiJson } from "../api.js";
import { destroyMap, loadLeaflet, loadLiveMapLibs } from "../map-loader.js";
import { setupMapChrome } from "../map-style.js";
import { buildHash } from "../router.js";
import { errorState, loadingState } from "../ui.js";
import { debounce, esc } from "../util.js";

const LOCATION_API = "api/location.php";
const ROUTE_API = "api/route.php";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
const LOCATION_REFRESH_MS = 10000;
const DELIVERY_REFRESH_MS = 60000;
const STALE_SECONDS = 5 * 60;
const MOVE_REDRAW_METERS = 100;
const ROUTE_ANIM_MS_PER_KM = 450;
const ROUTE_ANIM_MIN_MS = 900;
const ROUTE_ANIM_MAX_MS = 3500;
const MAX_ROUTED_STOPS = 5;

const COMPANY = {
  name: "Company",
  address: "Campanilla, Quezon City, 1112 Metro Manila",
  lat: 14.624556610241402,
  lng: 121.03696233024351,
};

const ago = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "unknown";
  if (value < 60) return `${value}s ago`;
  if (value < 3600) return `${Math.floor(value / 60)} min ago`;
  if (value < 86400) return `${Math.floor(value / 3600)} h ago`;
  return `${Math.floor(value / 86400)} days ago`;
};

const template = () => `
  <div class="spaViewHead">
    <div>
      <div class="spaHeadMeta"><span id="lmUpdated" role="status">Loading…</span></div>
      <h1 tabindex="-1">Live Map</h1>
      <p>Riders with an active delivery and their last reported position.</p>
    </div>
    <div class="spaChipRow" id="lmChips" role="group" aria-label="Filter riders"></div>
  </div>

  <div class="spaLive">
    <section class="spaPanel spaLiveList" aria-label="Riders">
      <div class="spaPanelHead">
        <strong>Riders</strong>
        <span class="mutedText" id="lmCount">0</span>
      </div>
      <div class="spaLiveRows" id="lmRows"></div>
    </section>

    <div class="spaLiveMain">
      <section class="spaPanel" aria-label="Rider map">
        <div class="spaLiveMapWrap">
          <div class="spaLiveMap" id="liveMap" aria-label="Rider map"></div>
          <div class="spaLiveControls">
            <button type="button" id="lmFit">Fit rider</button>
            <button type="button" id="lmRefresh">Refresh</button>
          </div>
          <div class="spaMapNotice" id="lmNotice" hidden>
            <strong id="lmNoticeTitle">Loading map</strong>
            <p id="lmNoticeText">Warming up the map library.</p>
          </div>
        </div>
      </section>

      <div class="spaLiveInsights">
        <section class="spaPanel" aria-label="Route overview">
          <div class="spaPanelHead">
            <strong>Route overview</strong>
            <span class="mutedText" id="lmRouteMeta">—</span>
          </div>
          <div class="spaPanelBody" id="lmRoute"></div>
        </section>

        <section class="spaPanel" aria-label="Rider details">
          <div class="spaPanelHead">
            <strong>Rider details</strong>
          </div>
          <div class="spaPanelBody" id="lmDetails"></div>
        </section>
      </div>
    </div>
  </div>`;

export default {
  route: "live-map",
  title: "Live Map",
  group: "Operations",

  async mount(root, ctx) {
    root.innerHTML = template();

    const $ = (id) => root.querySelector(`#${id}`) || document.getElementById(id);
    const rowsEl = $("lmRows");
    const chipsEl = $("lmChips");
    const countEl = $("lmCount");
    const updatedEl = $("lmUpdated");
    const mapEl = $("liveMap");
    const noticeEl = $("lmNotice");
    const noticeTitle = $("lmNoticeTitle");
    const noticeText = $("lmNoticeText");
    const fitBtn = $("lmFit");
    const refreshBtn = $("lmRefresh");
    const routeEl = $("lmRoute");
    const routeMeta = $("lmRouteMeta");
    const detailsEl = $("lmDetails");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let alive = true;
    let L = null;
    let map = null;
    let roadLayer = null;
    let selectionLayer = null;

    let activeRiders = [];
    let locations = {};
    let selectedId = null;
    let riderMarker = null;
    let currentRoute = null;
    let drawToken = 0;
    let routeLines = [];
    let destMarkers = [];

    let query = "";
    let freshness = ""; // "" | "live" | "stale"
    let loading = true;
    let failure = "";

    const urlParams = Object.fromEntries(ctx.route.params);

    const syncUrl = (patch) => {
      Object.assign(urlParams, patch);
      Object.keys(urlParams).forEach((key) => {
        if (urlParams[key] === null || urlParams[key] === undefined || urlParams[key] === "") {
          delete urlParams[key];
        }
      });
      const hash = buildHash("live-map", urlParams);
      if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
    };

    /* ---------- theme colors ---------- */

    const themeColor = (name, fallback) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return value || fallback;
    };
    const routeFromColor = () => themeColor("--route-a", "#161616");
    const stopColor = (index) => themeColor(`--stop-${(index % 5) + 1}`, "#2f6df6");

    const showNotice = (title, text) => {
      noticeTitle.textContent = title;
      noticeText.textContent = text;
      noticeEl.hidden = false;
    };
    const hideNotice = () => {
      noticeEl.hidden = true;
    };

    const companyIcon = () =>
      L.divIcon({
        className: "",
        html: `<div class="company-marker"><span class="building" aria-hidden="true"></span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

    const riderIcon = (fresh) =>
      L.divIcon({
        className: "",
        html: `<div class="location-marker ${fresh ? "fresh" : "stale"}"><span class="truck" aria-hidden="true"></span></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

    const destPin = (color, number) =>
      L.divIcon({
        className: "",
        html: `<span class="destPin" style="--pin-color:${color}">${
          number ? `<b>${number}</b>` : ""
        }</span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34],
        tooltipAnchor: [18, -20],
      });

    const initMap = async () => {
      try {
        const libs = await loadLiveMapLibs();
        L = libs.L;
      } catch (error) {
        console.error(error);
        try {
          L = await loadLeaflet();
        } catch {
          L = null;
        }
      }
      if (!alive) return;
      if (!L) {
        showNotice("Map unavailable", "The map library could not load. Rider details still work.");
        return;
      }

      map = L.map(mapEl, {
        zoomControl: false,
        zoomAnimation: !reduceMotion,
        zoomAnimationThreshold: 4,
        fadeAnimation: !reduceMotion,
        markerZoomAnimation: !reduceMotion,
      }).setView([COMPANY.lat, COMPANY.lng], 12);

      roadLayer = L.layerGroup().addTo(map);
      selectionLayer = L.layerGroup().addTo(map);

      L.marker([COMPANY.lat, COMPANY.lng], { icon: companyIcon(), zIndexOffset: 500 })
        .addTo(map)
        .bindPopup(`<b>${esc(COMPANY.name)}</b><br>${esc(COMPANY.address)}`);

      setupMapChrome(L, map, root, { isAlive: () => alive });
      hideNotice();

      requestAnimationFrame(() => {
        try {
          map.invalidateSize();
        } catch {
          /* view replaced */
        }
      });
    };

    /* ---------- data ---------- */

    const loadDeliveries = async () => {
      const data = await apiJson(ROUTE_API, { signal: ctx.signal });
      activeRiders = Array.isArray(data.routes) ? data.routes : [];
    };

    const loadLocations = async () => {
      const data = await apiJson(LOCATION_API, { signal: ctx.signal });
      locations = {};
      (Array.isArray(data.riders) ? data.riders : []).forEach((rider) => {
        locations[String(rider.driver_id)] = rider;
      });
    };

    const allRiders = () => {
      const merged = new Map();
      activeRiders.forEach((rider) => {
        merged.set(String(rider.driver_id), {
          driver_id: rider.driver_id,
          name: rider.driver_name,
          stops: rider.stops || [],
        });
      });
      Object.values(locations).forEach((location) => {
        const id = String(location.driver_id);
        if (!merged.has(id)) {
          merged.set(id, { driver_id: location.driver_id, name: location.name, stops: [] });
        }
      });
      return [...merged.values()].sort(
        (a, b) => (b.stops.length > 0) - (a.stops.length > 0) || a.name.localeCompare(b.name)
      );
    };

    const isFresh = (location) => Boolean(location) && Number(location.seconds_ago) <= STALE_SECONDS;

    const riderLabel = (id, name) => {
      const location = locations[String(id)];
      return location && location.del_number ? `${location.del_number} - ${name}` : name;
    };

    /* ---------- list ---------- */

    const visibleRiders = () => {
      const needle = query.trim().toLowerCase();
      return allRiders().filter((rider) => {
        const location = locations[String(rider.driver_id)];
        if (freshness === "live" && !isFresh(location)) return false;
        if (freshness === "stale" && isFresh(location)) return false;
        if (!needle) return true;
        const haystack = [
          riderLabel(rider.driver_id, rider.name),
          location?.del_number,
          ...rider.stops.map((stop) => stop.customer_name),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      });
    };

    const renderChips = () => {
      const chips = [
        { value: "", label: "All" },
        { value: "live", label: "Live" },
        { value: "stale", label: "Stale" },
      ];
      chipsEl.innerHTML = chips
        .map(
          (chip) =>
            `<button type="button" class="spaChip" data-freshness="${chip.value}" aria-pressed="${
              freshness === chip.value ? "true" : "false"
            }">${chip.label}</button>`
        )
        .join("");
    };

    const renderList = () => {
      if (loading) {
        rowsEl.innerHTML = loadingState("Loading riders…");
        countEl.textContent = "0";
        return;
      }
      if (failure) {
        rowsEl.innerHTML = errorState(failure);
        countEl.textContent = "0";
        return;
      }

      const riders = visibleRiders();
      countEl.textContent = `${riders.length} of ${allRiders().length}`;

      if (!riders.length) {
        rowsEl.innerHTML = `<div class="spaEmpty"><strong>No riders found</strong><p>${
          allRiders().length
            ? "Try a different search or filter."
            : "No rider has reported a location yet."
        }</p></div>`;
        return;
      }

      rowsEl.innerHTML = riders
        .map((rider) => {
          const id = String(rider.driver_id);
          const location = locations[id];
          const fresh = isFresh(location);
          const stopCount = rider.stops.length;
          const firstStop = rider.stops[0]?.customer_name;
          return `<button type="button" class="spaLiveRow" data-id="${esc(id)}" aria-pressed="${
            selectedId === id ? "true" : "false"
          }"${location ? "" : " disabled"}>
            <span class="spaDot ${fresh ? "is-fresh" : "is-stale"}" aria-hidden="true"></span>
            <span class="spaLiveRowBody">
              <strong>${esc(riderLabel(id, rider.name))}</strong>
              <small>${stopCount} active ${stopCount === 1 ? "delivery" : "deliveries"} · ${
                location ? `Updated ${esc(ago(location.seconds_ago))}` : "No location yet"
              }</small>
              ${firstStop ? `<small>Next: ${esc(firstStop)}</small>` : ""}
            </span>
          </button>`;
        })
        .join("");
    };

    /* ---------- insights ---------- */

    const infoRow = (label, value) =>
      `<div class="viewRow"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

    const renderInfo = () => {
      const location = locations[selectedId];
      const rider = allRiders().find((item) => String(item.driver_id) === selectedId);

      if (!location || !rider) {
        routeEl.innerHTML = `<p class="spaEmptyInline">Select a rider to see the route breakdown.</p>`;
        detailsEl.innerHTML = `<p class="spaEmptyInline">No rider selected.</p>`;
        routeMeta.textContent = "—";
        return;
      }

      const label = riderLabel(location.driver_id, location.name);
      if (!currentRoute) {
        routeMeta.textContent = "—";
        routeEl.innerHTML = map
          ? `<p class="spaEmptyInline">Building the route for ${esc(label)}…</p>`
          : `<p class="spaEmptyInline">Map unavailable, so the route cannot be drawn for ${esc(
              label
            )}.</p>`;
      } else {
        const legs = currentRoute.stops || [];
        const legTotal = legs.reduce((sum, leg) => sum + Number(leg.km || 0), 0);
        routeMeta.textContent = `${(currentRoute.km + legTotal).toFixed(1)} km total`;

        routeEl.innerHTML = `
          <div class="spaSegBar" role="img" aria-label="Distance per leg">
            <span style="flex:${Math.max(currentRoute.km, 0.15)};background:${routeFromColor()}"></span>
            ${legs
              .map(
                (leg, index) =>
                  `<span style="flex:${Math.max(Number(leg.km) || 0, 0.15)};background:${stopColor(
                    index
                  )}"></span>`
              )
              .join("")}
          </div>
          <div class="spaSegLegend">
            <span><i style="background:${routeFromColor()}"></i>Company → rider · ${currentRoute.km.toFixed(
              1
            )} km${currentRoute.road ? "" : " (straight line)"}</span>
            ${legs
              .map((leg, index) => {
                const name = leg.s?.customer_name || `Stop ${index + 1}`;
                const fromPrevious =
                  index === 0 ? "from rider" : `from previous stop`;
                return `<span><i style="background:${stopColor(index)}"></i>${esc(
                  name
                )} · ${Number(leg.km || 0).toFixed(1)} km ${fromPrevious}${
                  leg.road ? "" : " (straight line)"
                }</span>`;
              })
              .join("")}
          </div>
          ${
            (currentRoute.missing || []).length
              ? `<p class="spaNote">Address not on the map yet: ${currentRoute.missing
                  .map((stop) => esc(stop.customer_name))
                  .join(", ")}</p>`
              : ""
          }
          <p class="spaNote">Distances are road estimates when the routing service answers; dashed legs on the map mean a straight line.</p>`;
      }

      const legs = currentRoute?.stops || [];
      const legTotal = legs.reduce((sum, leg) => sum + Number(leg.km || 0), 0);
      detailsEl.innerHTML = `
        <div class="spaLiveWho">
          <strong>${esc(label)}</strong>
          <span>Last report ${esc(ago(location.seconds_ago))}${
            location.reported_at ? ` · ${esc(location.reported_at)}` : ""
          }</span>
        </div>
        <dl class="viewList">
          ${infoRow("Active deliveries", esc(String(rider.stops.length)))}
          ${infoRow("Stops with pins", esc(String(legs.length)))}
          ${infoRow(
            "Company → rider",
            currentRoute
              ? `${currentRoute.km.toFixed(1)} km${currentRoute.road ? "" : " (straight line)"}`
              : "—"
          )}
          ${infoRow("Rider → stops", currentRoute ? `${legTotal.toFixed(1)} km` : "—")}
          ${infoRow(
            "Total",
            currentRoute ? `${(currentRoute.km + legTotal).toFixed(1)} km` : "—"
          )}
        </dl>`;
    };

    /* ---------- selection + route ---------- */

    const clearSelection = () => {
      drawToken += 1;
      if (selectionLayer) selectionLayer.clearLayers();
      if (roadLayer) roadLayer.clearLayers();
      riderMarker = null;
      currentRoute = null;
      routeLines = [];
      destMarkers = [];
      renderInfo();
    };

    const orderStops = (start, list) => {
      const left = [...list];
      const ordered = [];
      let current = start;
      while (left.length) {
        let best = 0;
        let bestDistance = Infinity;
        left.forEach((stop, index) => {
          const distance = current.distanceTo(L.latLng(stop.lat, stop.lng));
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        const [next] = left.splice(best, 1);
        ordered.push(next);
        current = L.latLng(next.lat, next.lng);
      }
      return ordered;
    };

    const getRoadRoute = async (from, to) => {
      const straight = { points: [from, to], km: from.distanceTo(to) / 1000, road: false };
      try {
        const response = await fetch(
          `${OSRM_URL}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
          { signal: ctx.signal }
        );
        const data = await response.json();
        if (data.code !== "Ok" || !data.routes.length) return straight;
        const route = data.routes[0];
        return {
          points: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
          km: route.distance / 1000,
          road: true,
        };
      } catch {
        return straight;
      }
    };

    const lineEls = ({ line, casing }) =>
      [line, casing].filter(Boolean).map((layer) => layer.getElement()).filter(Boolean);

    const hideLine = ({ line, casing }) => {
      lineEls({ line, casing }).forEach((element) => {
        element.style.opacity = "0";
      });
    };

    const animateLine = ({ line, casing, road }, duration) => {
      const elements = lineEls({ line, casing });
      if (!elements.length || !elements[0].animate) return Promise.resolve();
      elements.forEach((element) => {
        element.style.opacity = "";
      });
      if (!road) {
        return Promise.all(
          elements.map((element) =>
            element.animate([{ opacity: 0 }, { opacity: 1 }], {
              duration: 600,
              easing: "ease-out",
            }).finished
          )
        ).catch(() => {});
      }
      const runs = elements.map((element) => {
        element.setAttribute("pathLength", "1");
        element.style.strokeDasharray = "1";
        return element.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
          duration,
          easing: "ease-in-out",
          fill: "both",
        });
      });
      return Promise.all(runs.map((run) => run.finished))
        .then(() => {
          elements.forEach((element) => {
            element.style.strokeDasharray = "";
          });
          runs.forEach((run) => run.cancel());
        })
        .catch(() => {});
    };

    const showSelected = async (fit) => {
      if (!map) {
        renderInfo();
        return;
      }
      const animate = Boolean(fit);
      clearSelection();
      const token = drawToken;
      const location = locations[selectedId];
      const rider = allRiders().find((item) => String(item.driver_id) === selectedId);
      if (!location || !rider) return;

      const here = L.latLng(Number(location.latitude), Number(location.longitude));
      const company = L.latLng(COMPANY.lat, COMPANY.lng);
      const fresh = isFresh(location);

      riderMarker = L.marker(here, { icon: riderIcon(fresh), zIndexOffset: 1000 })
        .addTo(selectionLayer)
        .bindPopup(
          `<b>${esc(riderLabel(location.driver_id, location.name))}</b><br>Last report: ${esc(
            location.reported_at
          )} (${esc(ago(location.seconds_ago))})`
        );

      if (!reduceMotion) {
        riderMarker.on("click", () => {
          map.flyTo(here, Math.max(map.getZoom(), 15), { duration: 0.6, easeLinearity: 0.25 });
        });
      }

      const stops = orderStops(
        here,
        (rider.stops || []).filter((stop) => stop.lat != null && stop.lng != null).slice(0, MAX_ROUTED_STOPS)
      );
      const missing = (rider.stops || []).filter((stop) => stop.lat == null || stop.lng == null);
      const bounds = [company, here];

      stops.forEach((stop, index) => {
        const destination = L.latLng(stop.lat, stop.lng);
        bounds.push(destination);
        const marker = L.marker(destination, { icon: destPin(stopColor(index), index + 1) })
          .addTo(selectionLayer)
          .bindPopup(
            `<b>${esc(stop.customer_name)}</b><br>${esc(stop.address)}<br>Delivery ${esc(
              stop.del_number
            )}`
          );
        marker._n = index + 1;
        marker._stopIndex = index;
        destMarkers.push(marker);
      });

      if (fit) {
        if (reduceMotion) {
          map.fitBounds(L.latLngBounds(bounds).pad(0.2), { maxZoom: 16 });
        } else {
          map.flyToBounds(L.latLngBounds(bounds).pad(0.2), {
            maxZoom: 16,
            duration: 0.8,
            easeLinearity: 0.25,
          });
        }
      }

      const points = [here, ...stops.map((stop) => L.latLng(stop.lat, stop.lng))];
      const [route, ...remaining] = await Promise.all([
        getRoadRoute(company, here),
        ...stops.map((stop, index) => getRoadRoute(points[index], points[index + 1])),
      ]);
      if (token !== drawToken || !alive) return;

      const makeLine = (roadRoute, kind, stopIndex = 0) => {
        const color = kind === "from" ? routeFromColor() : stopColor(stopIndex);
        const casing = roadRoute.road
          ? L.polyline(roadRoute.points, {
              weight: 9,
              opacity: 0.9,
              className: "route-casing",
              interactive: false,
            }).addTo(roadLayer)
          : null;
        const line = L.polyline(
          roadRoute.points,
          roadRoute.road
            ? { color, weight: 5, opacity: 0.9, className: "route-line" }
            : { color, weight: 4, dashArray: "6 8", className: "route-line" }
        ).addTo(roadLayer);
        routeLines.push({ line, casing, kind, stopIndex, road: roadRoute.road });
        return { line, casing, km: roadRoute.km, road: roadRoute.road };
      };

      const first = makeLine(route, "from");
      const rest = remaining.map((roadRoute, index) => makeLine(roadRoute, "to", index));

      if (animate) {
        const ms = (km) =>
          Math.min(ROUTE_ANIM_MAX_MS, Math.max(ROUTE_ANIM_MIN_MS, km * ROUTE_ANIM_MS_PER_KM));
        rest.forEach((leg) => hideLine(leg));
        destMarkers.forEach((marker) => marker.setOpacity(0));
        animateLine(first, ms(first.km)).then(() => {
          if (token !== drawToken) return;
          destMarkers.forEach((marker) => marker.setOpacity(1));
          (async () => {
            for (const leg of rest) {
              if (token !== drawToken) return;
              await animateLine(leg, ms(leg.km));
            }
          })();
        });
      }

      currentRoute = {
        ...route,
        stops: stops.map((stop, index) => ({
          s: stop,
          km: remaining[index].km,
          road: remaining[index].road,
        })),
        missing,
      };
      renderInfo();
    };

    const selectRider = (id) => {
      selectedId = id ? String(id) : null;
      syncUrl({ rider: selectedId ?? null });
      renderList();
      renderInfo();
      showSelected(true).catch((error) => console.error(error));
    };

    /* ---------- refresh ---------- */

    const refreshDeliveries = async () => {
      try {
        await loadDeliveries();
        if (!alive) return;
        failure = "";
        if (selectedId) showSelected(false).catch((error) => console.error(error));
        renderList();
      } catch (error) {
        if (error?.name === "AbortError") return;
        if (!activeRiders.length) failure = "Could not load active deliveries.";
        updatedEl.textContent = `Error: ${error.message || "could not load routes"}`;
        renderList();
      }
    };

    const refreshLocations = async () => {
      try {
        const before = locations;
        await loadLocations();
        if (!alive) return;

        if (Object.keys(before).some((id) => !locations[id])) {
          await loadDeliveries();
          if (!alive) return;
        }

        if (selectedId) {
          const location = locations[selectedId];
          const moved =
            location &&
            (!riderMarker ||
              L.latLng(Number(location.latitude), Number(location.longitude)).distanceTo(
                riderMarker.getLatLng()
              ) >= MOVE_REDRAW_METERS);
          if (!location) {
            selectedId = null;
            syncUrl({ rider: null });
            clearSelection();
          } else if (moved || !currentRoute) showSelected(false).catch((error) => console.error(error));
          else {
            const fresh = isFresh(location);
            const shownFresh = riderMarker?.options?.icon?.options?.html?.includes(
              "location-marker fresh"
            );
            if (shownFresh !== fresh && riderMarker) riderMarker.setIcon(riderIcon(fresh));
            renderInfo();
          }
        }

        renderList();
        updatedEl.textContent = `Updated ${new Date().toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        })}`;
      } catch (error) {
        if (error?.name === "AbortError") return;
        updatedEl.textContent = `Error: ${error.message || "could not load locations"}`;
      }
    };

    const refreshAll = async () => {
      refreshBtn.disabled = true;
      try {
        await refreshDeliveries();
        await refreshLocations();
      } finally {
        refreshBtn.disabled = false;
      }
    };

    /* ---------- boot ---------- */

    showNotice("Loading map", "Warming up the map library.");
    renderChips();
    renderList();
    routeEl.innerHTML = `<p class="spaEmptyInline">Select a rider to see the route breakdown.</p>`;
    detailsEl.innerHTML = `<p class="spaEmptyInline">No rider selected.</p>`;

    ctx.setSearch({
      placeholder: "Search rider, delivery, or customer",
      label: "Search riders",
      onInput: debounce((value) => {
        query = value;
        renderList();
      }, 120),
    });
    ctx.setCta({ label: "Refresh", onClick: () => refreshAll() });

    chipsEl.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-freshness]");
      if (!chip) return;
      freshness = chip.dataset.freshness;
      renderChips();
      renderList();
    });

    rowsEl.addEventListener("click", (event) => {
      const row = event.target.closest("[data-id]");
      if (!row || row.disabled) return;
      if (selectedId === row.dataset.id) return;
      selectRider(row.dataset.id);
    });

    fitBtn.addEventListener("click", () => {
      if (!selectedId) return;
      showSelected(true).catch((error) => console.error(error));
    });
    refreshBtn.addEventListener("click", () => {
      refreshAll().catch((error) => console.error(error));
    });

    const bailOut = () => {
      alive = false;
      if (map) {
        destroyMap(map);
        map = null;
      }
    };

    await initMap();
    if (!alive) return bailOut;

    try {
      await refreshDeliveries();
      await refreshLocations();
    } catch (error) {
      if (error?.name !== "AbortError") console.error(error);
    }
    if (!alive) return bailOut;

    loading = false;
    renderList();

    if (urlParams.rider && locations[urlParams.rider]) selectRider(urlParams.rider);
    else if (urlParams.rider) syncUrl({ rider: null });

    const themeObserver = new MutationObserver(() => {
      routeLines.forEach(({ line, kind, stopIndex }) => {
        line.setStyle({
          color: kind === "from" ? routeFromColor() : stopColor(stopIndex),
        });
      });
      destMarkers.forEach((marker) => marker.setIcon(destPin(stopColor(marker._stopIndex), marker._n)));
      if (currentRoute) renderInfo();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    const locationTimer = setInterval(() => {
      if (document.hidden) return;
      refreshLocations().catch(() => {});
    }, LOCATION_REFRESH_MS);

    const deliveryTimer = setInterval(() => {
      if (document.hidden) return;
      refreshDeliveries().catch(() => {});
    }, DELIVERY_REFRESH_MS);

    const onVisible = () => {
      if (document.hidden) return;
      refreshAll().catch(() => {});
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
      clearInterval(locationTimer);
      clearInterval(deliveryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("resize", onResize);
      themeObserver.disconnect();
      drawToken += 1;
      if (map) {
        destroyMap(map);
        map = null;
        roadLayer = null;
        selectionLayer = null;
      }
    };
  },
};

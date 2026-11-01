import type { Tutor } from "@/types/tutor";
import { t as translate } from "@/i18n";

/** Position par défaut (Antananarivo) quand un tuteur n'a pas de coordonnées. */
const DEFAULT_CENTER: [number, number] = [47.525, -18.895];
const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const MAPLIBRE_VERSION = "4.7.1";
/** Vue inclinée : perspective, légère rotation, zoom assez proche pour voir les bâtiments en relief (≥ 14). */
export const MAP_PITCH = 55;
export const MAP_BEARING = -17;
export const MAP_ZOOM = 14.5;

type Point = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  gender: "male" | "female" | null;
  /** Tarif de la première offre (« 25 000 Ar ») : c'est lui que montre la pilule du repère. */
  price: string;
};

export function toPoints(tutors: Tutor[]): Point[] {
  return tutors.map((tutor, index) => {
    const hasCoords = tutor.location.longitude != null && tutor.location.latitude != null;
    // Sans coordonnées : on les répartit autour du centre pour qu'ils restent visibles et distincts.
    const angle = (index * 2 * Math.PI) / Math.max(3, tutors.length);
    return {
      id: tutor.id,
      name: `${tutor.firstName} ${tutor.lastName}`.trim(),
      lng: hasCoords ? (tutor.location.longitude as number) : DEFAULT_CENTER[0] + 0.012 * Math.cos(angle),
      lat: hasCoords ? (tutor.location.latitude as number) : DEFAULT_CENTER[1] + 0.012 * Math.sin(angle),
      gender: tutor.gender,
      price: tutor.offers[0]?.priceLabel ?? "",
    };
  });
}

/**
 * Page autonome de la carte (MapLibre GL JS + fond OpenFreeMap — aucune clé d'API).
 * Sert de carte quand le module natif MapLibre est indisponible (Expo Go) et sur le web.
 *
 * Échanges avec l'application :
 *  - page → app : `{ type: "ready" | "select" | "error", id? }` (postMessage) ;
 *  - app → page : `window.__select(id)` centre la carte sur le tuteur et le met en avant.
 */
export type MapOrigin = { latitude: number; longitude: number };

export function buildResultsMapHtml(tutors: Tutor[], selectedId: string | null, origin: MapOrigin | null = null): string {
  const points = toPoints(tutors);
  const first = points.find((p) => p.id === selectedId) ?? points[0];
  const center = first ? [first.lng, first.lat] : DEFAULT_CENTER;
  const data = JSON.stringify({ points, selectedId, center, origin: origin ? [origin.longitude, origin.latitude] : null, style: MAP_STYLE_URL, pitch: MAP_PITCH, bearing: MAP_BEARING, zoom: MAP_ZOOM }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link href="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css" rel="stylesheet" />
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #f1f5f9; font-family: -apple-system, system-ui, sans-serif; }
  .pill { background: #fff; color: #332e86; font: 700 12.5px -apple-system, system-ui, sans-serif; padding: 6px 11px; border-radius: 999px; border: 1px solid #eef2f7; box-shadow: 0 3px 10px rgba(20,22,43,.22); white-space: nowrap; cursor: pointer; transition: background .15s, color .15s; }
  .pill.sel { background: #332e86; color: #fff; border-color: #332e86; font-size: 13.5px; padding: 7px 13px; box-shadow: 0 6px 16px rgba(51,46,134,.45); }
  .me { position: relative; width: 18px; height: 18px; }
  .me i { position: absolute; inset: 0; border-radius: 50%; background: #1d7cf2; border: 3px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.35); }
  .me b { position: absolute; left: -11px; top: -11px; width: 40px; height: 40px; border-radius: 50%; background: rgba(29,124,242,.28); animation: pulse 2s ease-out infinite; }
  .me span { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); background: #1d7cf2; color: #fff; font: 700 10.5px -apple-system, system-ui, sans-serif; padding: 2px 7px; border-radius: 9px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  @keyframes pulse { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(1.5); opacity: 0; } }
  .ctl { position: absolute; right: 14px; z-index: 5; width: 38px; height: 38px; border: 0; border-radius: 19px; background: #fff; box-shadow: 0 3px 10px rgba(20,22,43,.18); font: 700 15px -apple-system, system-ui, sans-serif; color: #332e86; cursor: pointer; padding: 0; }
  #msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #585b78; font-size: 13.5px; background: #f1f5f9; padding: 24px; text-align: center; }
</style>
</head><body>
<div id="map"></div>
<div id="msg">${translate("map.resultsMapHtml.loadingTheMap")}</div>
<button id="fit" class="ctl" type="button" aria-label="${translate("map.resultsMapHtml.fitMap")}" style="top:122px">&#9678;</button>
<script src="https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js"></script>
<script>
(function () {
  var DATA = ${data};
  function send(payload) {
    var text = JSON.stringify(payload);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(payload, "*");
  }
  var msg = document.getElementById("msg");
  if (!window.maplibregl) { msg.textContent = ${JSON.stringify(translate("map.resultsMapHtml.mapUnavailable"))}; send({ type: "error" }); return; }

  var map = new maplibregl.Map({ container: "map", style: DATA.style, center: DATA.center, zoom: DATA.zoom, pitch: DATA.pitch, bearing: DATA.bearing, maxPitch: 70, attributionControl: { compact: true } });
  window.__map = map; // exposé pour le diagnostic
  var markers = {};
  var tilted = DATA.pitch > 0;
  var selectedId = DATA.selectedId;

  // Position du demandeur : point bleu pulsant « Vous ».
  if (DATA.origin) {
    var me = document.createElement("div");
    me.className = "me";
    me.innerHTML = "<b></b><i></i><span>" + ${JSON.stringify(translate("map.resultsMapHtml.you"))} + "</span>";
    me.setAttribute("aria-label", ${JSON.stringify(translate("map.resultsMapHtml.yourPosition"))});
    new maplibregl.Marker({ element: me, anchor: "center" }).setLngLat(DATA.origin).addTo(map);
  }

  // Cadrage : l'échelle s'adapte à la distance entre le demandeur et les tuteurs (plus ils sont loin, plus on recule).
  function fitAll(animate) {
    var pts = DATA.points.map(function (p) { return [p.lng, p.lat]; });
    if (DATA.origin) pts.push(DATA.origin);
    if (!pts.length) return;
    var bounds = pts.reduce(function (b, c) { return b.extend(c); }, new maplibregl.LngLatBounds(pts[0], pts[0]));
    map.fitBounds(bounds, {
      padding: { top: 70, bottom: 190, left: 55, right: 65 },
      maxZoom: 15.5, pitch: tilted ? DATA.pitch : 0, bearing: tilted ? DATA.bearing : 0,
      duration: animate ? 800 : 0
    });
  }
  document.getElementById("fit").addEventListener("click", function () { fitAll(true); });

  function paint() {
    DATA.points.forEach(function (p) {
      var sel = p.id === selectedId;
      var el = markers[p.id].getElement();
      // classList : MapLibre pose lui-même sa classe de positionnement sur l'élément du repère.
      el.classList.toggle("sel", sel);
      el.style.zIndex = sel ? "2" : "1";
    });
  }

  DATA.points.forEach(function (p) {
    var el = document.createElement("div");
    el.className = "pill";
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", p.name);
    // Le tarif d'abord (critère n°1 du choix) ; à défaut, le prénom.
    el.textContent = p.price || p.name.split(" ")[0];
    el.addEventListener("click", function (e) { e.stopPropagation(); window.__select(p.id, true); });
    markers[p.id] = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([p.lng, p.lat]).addTo(map);
  });

  window.__select = function (id, fromTap) {
    selectedId = id;
    paint();
    var p = DATA.points.filter(function (x) { return x.id === id; })[0];
    if (p && !fromTap) map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), DATA.zoom), duration: 700 });
    if (fromTap) send({ type: "select", id: id });
  };

  // Bâtiments en relief (couche « building » du fond OpenFreeMap), sous les libellés pour qu'ils restent lisibles.
  function add3dBuildings() {
    try {
      var style = map.getStyle();
      var source = Object.keys(style.sources).filter(function (k) { return style.sources[k].type === "vector"; })[0];
      if (!source || map.getLayer("building-3d")) return;
      var firstSymbol = (style.layers.filter(function (l) { return l.type === "symbol"; })[0] || {}).id;
      map.addLayer({
        id: "building-3d", type: "fill-extrusion", source: source, "source-layer": "building", minzoom: 14,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 6], 0, "#ece9f9", 60, "#d6d1f3", 200, "#b9b2e8"],
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.88
        }
      }, firstSymbol);
    } catch (err) { console.log("3d buildings:", err && err.message); }
  }

  fitAll(false);

  map.on("load", function () { add3dBuildings(); msg.style.display = "none"; paint(); send({ type: "ready" }); });
  map.on("error", function (e) { console.log("map error:", e && e.error ? e.error.message : String(e)); if (!map.loaded()) { msg.style.display = "flex"; msg.textContent = ${JSON.stringify(translate("map.resultsMapHtml.unableToLoad"))}; send({ type: "error" }); } });
  paint();
})();
</script>
</body></html>`;
}

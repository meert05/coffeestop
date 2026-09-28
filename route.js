// =====================================================
//  ROUTE PLANNEN – een fietsroute langs koffiebars
// =====================================================
//
// Zo werkt het:
//  1. Klik op "🚴 Route plannen".
//  2. Klik op de kaart om punten toe te voegen (start, tussenpunten, einde).
//  3. Klik op een bar (op de kaart of "➕ In route" in de lijst) om ze mee te nemen.
//  4. De app berekent een fietsroute over echte wegen en toont welke bars
//     er vlakbij liggen. Download de route als GPX voor je fietscomputer.
//
// De route wordt berekend door BRouter (brouter.de), een gratis routeplanner
// speciaal voor fietsers. Lukt dat niet, dan gebruiken we de eenvoudigere
// fietsrouteplanner van OpenStreetMap (routing.openstreetmap.de) als reserve.
// We bewaren je routes nergens.

const BROUTER = "https://brouter.de/brouter";
const RESERVE_SERVER = "https://routing.openstreetmap.de/routed-bike/route/v1/driving/";

// De fietsstijlen en het BRouter-profiel dat erbij hoort
const ROUTE_STIJLEN = {
  snel: "fastbike",                        // vlot over asfalt, koersfiets
  fietspaden: "trekking",                  // fietspaden, knooppunten, fietssnelwegen
  rustig: "fastbike-verylowtraffic"        // zo weinig mogelijk verkeer
};
let routeStijl = "fietspaden";
const ROUTE_SNELHEID = 25;       // km/u, om de rijtijd te schatten
const LANGS_ROUTE_KM = 2;        // bars tot zo ver van de route tonen we als tip

let routeModus = false;          // staat "Route plannen" aan?
let routePunten = [];            // [{ lat, lng, naam, stopId }] in volgorde
let routeRondrit = false;        // terug naar het startpunt?
let routeLijn = null;            // de berekende route: { punten: [[lat, lng, hoogte], …], km, hoogtemeters }
let routeTeller = 0;             // om oude antwoorden van de server te negeren

// Een eigen laag onder de stippen, zodat de bars bovenop de route liggen
kaart.createPane("routeLaag");
kaart.getPane("routeLaag").style.zIndex = 350;
const routeLaag = L.layerGroup().addTo(kaart);

// ---------- Route plannen aan- en uitzetten ----------
document.getElementById("routeKnop").onclick = () => {
  routeModus = !routeModus;
  document.getElementById("routeKnop").classList.toggle("actief", routeModus);
  document.getElementById("routePaneel").hidden = !routeModus;
  if (routeModus) document.getElementById("routePaneel").scrollIntoView({ behavior: "smooth", block: "nearest" });
  tekenStijlKnoppen();
  tekenRoutePaneel();
  tekenRouteOpKaart();
  teken();                        // de knopjes "➕ In route" verschijnen in de lijst
};

// Klikken op de kaart: een punt toevoegen
kaart.on("click", (event) => {
  if (!routeModus) return;
  routePunten.push({ lat: event.latlng.lat, lng: event.latlng.lng, naam: null, stopId: null });
  routeGewijzigd();
});

// Wordt opgeroepen door app.js als je op een bar op de kaart klikt.
// Geeft true terug als wij de klik afhandelen.
function routeKlikOpBar(stop) {
  if (!routeModus) return false;
  wisselBarInRoute(stop);
  return true;
}

// ---------- Bars toevoegen en verwijderen ----------
function barInRoute(stop) {
  return routePunten.some(p => p.stopId === stop.id);
}

function wisselBarInRoute(stop) {
  if (barInRoute(stop)) {
    routePunten = routePunten.filter(p => p.stopId !== stop.id);
  } else {
    voegInOpBesteplek({ lat: stop.lat, lng: stop.lng, naam: stop.naam, stopId: stop.id });
  }
  routeGewijzigd();
}

// Zet een punt tussen de twee punten waar het de kleinste omweg geeft
function voegInOpBesteplek(punt) {
  if (routePunten.length < 2) { routePunten.push(punt); return; }
  const p = [punt.lat, punt.lng];
  let beste = routePunten.length, kleinsteOmweg = Infinity;
  const aantal = routeRondrit ? routePunten.length : routePunten.length - 1;
  for (let i = 0; i < aantal; i++) {
    const a = routePunten[i], b = routePunten[(i + 1) % routePunten.length];
    const omweg = afstandKm([a.lat, a.lng], p) + afstandKm(p, [b.lat, b.lng]) - afstandKm([a.lat, a.lng], [b.lat, b.lng]);
    if (omweg < kleinsteOmweg) { kleinsteOmweg = omweg; beste = i + 1; }
  }
  // Achteraan toevoegen kan ook (geen rondrit): de omweg is dan de afstand vanaf het laatste punt
  if (!routeRondrit) {
    const laatste = routePunten[routePunten.length - 1];
    if (afstandKm([laatste.lat, laatste.lng], p) < kleinsteOmweg) beste = routePunten.length;
  }
  routePunten.splice(beste, 0, punt);
}

// Het knopje in de lijst met bars (app.js zet dit in elk kaartje)
function routeKnopHTML(stop) {
  if (!routeModus) return "";
  return `<button class="routeToevoegen ${barInRoute(stop) ? "actief" : ""}">
    ${barInRoute(stop) ? "✓ " + t("inRoute") : "➕ " + t("naarRoute")}</button>`;
}

function koppelRouteKnop(li, stop) {
  const knop = li.querySelector(".routeToevoegen");
  if (!knop) return;
  knop.onclick = (event) => {
    event.stopPropagation();
    wisselBarInRoute(stop);
  };
}

// ---------- Er veranderde iets: alles opnieuw tekenen en de route berekenen ----------
function routeGewijzigd() {
  tekenRoutePaneel();
  tekenRouteOpKaart();
  teken();
  berekenRoute();
}

async function berekenRoute() {
  const punten = [...routePunten];
  if (routeRondrit && punten.length >= 2) punten.push(punten[0]);
  if (punten.length < 2) {
    routeLijn = null;
    tekenRouteOpKaart();
    tekenRoutePaneel();
    return;
  }

  const mijnBeurt = ++routeTeller;
  const melding = document.getElementById("routeMelding");
  melding.textContent = t("routeBerekenen");

  try {
    const lijn = await vraagBRouter(punten);
    if (mijnBeurt !== routeTeller) return;          // er kwam intussen een nieuwere vraag
    routeLijn = lijn;
    melding.textContent = "";
  } catch (fout) {
    console.warn("BRouter lukte niet, we proberen de reserve", fout);
    try {
      const lijn = await vraagReserve(punten);
      if (mijnBeurt !== routeTeller) return;
      routeLijn = lijn;
      melding.textContent = t("routeReserve");
    } catch (fout2) {
      if (mijnBeurt !== routeTeller) return;
      console.error(fout2);
      routeLijn = null;
      melding.textContent = t("routeMislukt");
    }
  }
  tekenRouteOpKaart();
  tekenRoutePaneel();
}

// BRouter: de mooiste fietsroute volgens de gekozen stijl, met hoogtemeters
async function vraagBRouter(punten) {
  const lonlats = punten.map(p => p.lng.toFixed(5) + "," + p.lat.toFixed(5)).join("|");
  const url = BROUTER + "?lonlats=" + lonlats + "&profile=" + ROUTE_STIJLEN[routeStijl] +
              "&alternativeidx=0&format=geojson";
  const antwoord = await fetch(url);
  if (!antwoord.ok) throw new Error(await antwoord.text());
  const data = await antwoord.json();
  const route = data.features[0];
  return {
    punten: route.geometry.coordinates.map(([lng, lat, hoogte]) => [lat, lng, hoogte]),
    km: Number(route.properties["track-length"]) / 1000,
    hoogtemeters: Math.round(Number(route.properties["filtered ascend"]) || 0)
  };
}

// Reserve: de eenvoudige fietsrouteplanner van OpenStreetMap (zonder hoogtemeters)
async function vraagReserve(punten) {
  const coords = punten.map(p => p.lng.toFixed(5) + "," + p.lat.toFixed(5)).join(";");
  const antwoord = await fetch(RESERVE_SERVER + coords + "?overview=full&geometries=geojson");
  const data = await antwoord.json();
  if (data.code !== "Ok") throw new Error(data.message || data.code);
  const route = data.routes[0];
  return {
    punten: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    km: route.distance / 1000,
    hoogtemeters: null
  };
}

// De stijlknoppen: Snel · Fietspaden · Weinig verkeer
function tekenStijlKnoppen() {
  const rij = document.getElementById("routeStijlen");
  rij.innerHTML = "";
  for (const stijl of Object.keys(ROUTE_STIJLEN)) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.textContent = t("stijl_" + stijl);
    knop.classList.toggle("actief", stijl === routeStijl);
    knop.onclick = () => {
      routeStijl = stijl;
      tekenStijlKnoppen();
      berekenRoute();
    };
    rij.appendChild(knop);
  }
}

// ---------- De route op de kaart ----------
function tekenRouteOpKaart() {
  routeLaag.clearLayers();
  if (!routeModus) return;

  if (routeLijn) {
    L.polyline(routeLijn.punten, {
      pane: "routeLaag",
      color: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#F2F1EE",
      weight: 4,
      opacity: 0.9
    }).addTo(routeLaag);
  }

  // Genummerde punten; losse punten kun je verslepen
  routePunten.forEach((punt, i) => {
    const speld = L.marker([punt.lat, punt.lng], {
      draggable: !punt.stopId,
      icon: L.divIcon({
        className: "routePunt" + (punt.stopId ? " bar" : ""),
        html: String(i + 1),
        iconSize: [24, 24]
      })
    }).addTo(routeLaag);
    speld.bindTooltip(puntNaam(punt, i));
    speld.on("dragend", () => {
      const plek = speld.getLatLng();
      punt.lat = plek.lat;
      punt.lng = plek.lng;
      routeGewijzigd();
    });
    speld.on("click", () => {            // klik op een punt: verwijderen
      routePunten.splice(i, 1);
      routeGewijzigd();
    });
  });
}

function puntNaam(punt, i) {
  if (punt.naam) return punt.naam;
  if (i === 0) return t("routeStart");
  return t("routePunt") + " " + (i + 1);
}

// ---------- Het paneel naast de kaart ----------
function tekenRoutePaneel() {
  const paneel = document.getElementById("routePaneel");
  if (!routeModus) return;

  const lijst = paneel.querySelector("#routeStops");
  lijst.innerHTML = routePunten.map((punt, i) => `
    <li class="${punt.stopId ? "bar" : ""}">
      <span class="nr">${String(i + 1).padStart(2, "0")}</span>
      <span class="naam">${esc(puntNaam(punt, i))}</span>
      <span class="knopjes">
        <button data-op="${i}" ${i === 0 ? "disabled" : ""} aria-label="Omhoog">↑</button>
        <button data-neer="${i}" ${i === routePunten.length - 1 ? "disabled" : ""} aria-label="Omlaag">↓</button>
        <button data-weg="${i}" aria-label="Verwijderen">✕</button>
      </span>
    </li>`).join("");
  paneel.querySelector("#routeLeeg").hidden = routePunten.length > 0;

  lijst.querySelectorAll("[data-op]").forEach(k => k.onclick = () => verschuif(Number(k.dataset.op), -1));
  lijst.querySelectorAll("[data-neer]").forEach(k => k.onclick = () => verschuif(Number(k.dataset.neer), 1));
  lijst.querySelectorAll("[data-weg]").forEach(k => k.onclick = () => {
    routePunten.splice(Number(k.dataset.weg), 1);
    routeGewijzigd();
  });

  // Afstand en rijtijd
  const samenvatting = paneel.querySelector("#routeSamenvatting");
  if (routeLijn) {
    const uren = routeLijn.km / ROUTE_SNELHEID;
    const minuten = Math.round(uren * 60);
    const tijd = minuten < 60 ? minuten + " min"
      : Math.floor(minuten / 60) + "u" + String(minuten % 60).padStart(2, "0");
    samenvatting.innerHTML = `<b>${routeLijn.km.toFixed(1).replace(".", ",")} km</b>
      ${routeLijn.hoogtemeters !== null ? `<b class="hm">↗ ${routeLijn.hoogtemeters} hm</b>` : ""}
      <span>± ${tijd} ${t("aan")} ${ROUTE_SNELHEID} km/u</span>`;
  } else {
    samenvatting.innerHTML = "";
  }
  paneel.querySelector("#routeGpx").disabled = !routeLijn;
  paneel.querySelector("#routeGoogle").disabled = routePunten.length < 2;
  paneel.querySelector("#routeDelen").disabled = routePunten.length < 2;
  paneel.querySelector("#routeBewaar").disabled = !routeLijn;
  paneel.querySelector("#routeRondrit").checked = routeRondrit;

  tekenBarsLangsRoute();
}

function verschuif(i, richting) {
  const j = i + richting;
  if (j < 0 || j >= routePunten.length) return;
  [routePunten[i], routePunten[j]] = [routePunten[j], routePunten[i]];
  routeGewijzigd();
}

// ---------- Koffiebars langs je route ----------
// De kortste afstand (km) van een bar tot de routelijn
function afstandTotRoute(stop) {
  if (!routeLijn) return Infinity;
  const kmPerGraadLat = 111.32;
  const kmPerGraadLng = 111.32 * Math.cos(stop.lat * Math.PI / 180);
  const px = stop.lng * kmPerGraadLng, py = stop.lat * kmPerGraadLat;
  let kleinste = Infinity;
  const lijn = routeLijn.punten;
  for (let i = 0; i < lijn.length - 1; i++) {
    const ax = lijn[i][1] * kmPerGraadLng, ay = lijn[i][0] * kmPerGraadLat;
    const bx = lijn[i + 1][1] * kmPerGraadLng, by = lijn[i + 1][0] * kmPerGraadLat;
    const dx = bx - ax, dy = by - ay;
    const lengte2 = dx * dx + dy * dy;
    let f = lengte2 ? ((px - ax) * dx + (py - ay) * dy) / lengte2 : 0;
    f = Math.max(0, Math.min(1, f));
    const d = Math.hypot(px - (ax + f * dx), py - (ay + f * dy));
    if (d < kleinste) kleinste = d;
  }
  return kleinste;
}

function tekenBarsLangsRoute() {
  const blok = document.getElementById("routeTips");
  if (!routeLijn) { blok.innerHTML = ""; return; }

  const tips = alleStops
    .filter(stop => !barInRoute(stop))
    .map(stop => ({ stop, km: afstandTotRoute(stop) }))
    .filter(x => x.km <= LANGS_ROUTE_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, 8);

  blok.innerHTML = `<strong>☕ ${t("barsLangsRoute")}</strong>` + (tips.length === 0
    ? `<p class="leeg">${t("geenBarsLangsRoute")}</p>`
    : `<ul>${tips.map(({ stop, km }) => `
        <li>
          <span><b>${esc(stop.naam)}</b>
          <small>${km < 0.1 ? t("opDeRoute") : "+" + (2 * km).toFixed(1).replace(".", ",") + " km " + t("omweg")}</small></span>
          <button data-tip="${stop.id}">➕</button>
        </li>`).join("")}</ul>`);

  blok.querySelectorAll("[data-tip]").forEach(knop => {
    knop.onclick = () => wisselBarInRoute(alleStops.find(s => s.id === knop.dataset.tip));
  });
}

// ---------- Knoppen in het paneel ----------
document.getElementById("routeRondrit").onchange = (event) => {
  routeRondrit = event.target.checked;
  routeGewijzigd();
};

document.getElementById("routeWissen").onclick = () => {
  routePunten = [];
  routeLijn = null;
  routeGewijzigd();
};

// Start bij je eigen locatie
document.getElementById("routeHier").onclick = () => {
  if (!navigator.geolocation) { alert(t("geenLocatie")); return; }
  navigator.geolocation.getCurrentPosition(
    (positie) => {
      routePunten.unshift({ lat: positie.coords.latitude, lng: positie.coords.longitude, naam: t("mijnLocatie"), stopId: null });
      kaart.setView([positie.coords.latitude, positie.coords.longitude], 12);
      routeGewijzigd();
    },
    () => alert(t("locatieGeweigerd")),
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

// GPX downloaden: voor Garmin, Wahoo, Strava, Komoot, …
document.getElementById("routeGpx").onclick = () => {
  if (!routeLijn) return;
  const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const bars = routePunten.filter(p => p.stopId)
    .map(p => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>☕ ${xml(p.naam)}</name></wpt>`).join("\n");
  const spoor = routeLijn.punten
    .map(([lat, lng, hoogte]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">` +
         (hoogte !== undefined && hoogte !== null ? `<ele>${Number(hoogte).toFixed(1)}</ele>` : "") + `</trkpt>`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Roast Route" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Roast Route – ${routeLijn.km.toFixed(0)} km</name></metadata>
${bars}
  <trk>
    <name>Roast Route – ${routeLijn.km.toFixed(0)} km</name>
    <trkseg>
${spoor}
    </trkseg>
  </trk>
</gpx>`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
  link.download = "roast-route-" + routeLijn.km.toFixed(0) + "km.gpx";
  link.click();
  URL.revokeObjectURL(link.href);
};

// Openen in Google Maps (handig op je gsm). Google Maps neemt maximaal 9 tussenpunten.
document.getElementById("routeGoogle").onclick = () => {
  const punten = [...routePunten];
  if (routeRondrit) punten.push(punten[0]);
  if (punten.length < 2) return;
  const plek = p => p.lat.toFixed(5) + "," + p.lng.toFixed(5);
  const tussen = punten.slice(1, -1).slice(0, 9).map(plek).join("|");
  const url = "https://www.google.com/maps/dir/?api=1&travelmode=bicycling" +
    "&origin=" + plek(punten[0]) + "&destination=" + plek(punten[punten.length - 1]) +
    (tussen ? "&waypoints=" + encodeURIComponent(tussen) : "");
  window.open(url, "_blank");
};

// =====================================================
//  ROUTES DELEN EN BEWAREN
// =====================================================
//
// Delen: de route zit volledig in de link (…/#route=…). Wie de link opent,
// ziet na het inloggen meteen dezelfde route. Er wordt niets opgeslagen.
// Bewaren: in je account (tabel "routes"), zodat je ze later terugvindt.

let mijnRoutes = [];

// ---------- Een route omzetten naar een korte code voor in de link, en terug ----------
function routeNaarCode() {
  const gegevens = {
    s: routeStijl,
    r: routeRondrit ? 1 : 0,
    // Een bar bewaren we als haar id, een los punt als [breedte, lengte]
    p: routePunten.map(p => p.stopId ? { b: p.stopId } : [Number(p.lat.toFixed(5)), Number(p.lng.toFixed(5))])
  };
  // JSON → base64 (zonder tekens die lastig zijn in een link)
  return btoa(unescape(encodeURIComponent(JSON.stringify(gegevens))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codeNaarRoute(code) {
  const json = decodeURIComponent(escape(atob(code.replace(/-/g, "+").replace(/_/g, "/"))));
  const gegevens = JSON.parse(json);
  const punten = [];
  for (const p of gegevens.p || []) {
    if (Array.isArray(p)) {
      punten.push({ lat: Number(p[0]), lng: Number(p[1]), naam: null, stopId: null });
    } else {
      const stop = alleStops.find(s => s.id === p.b);
      if (stop) punten.push({ lat: stop.lat, lng: stop.lng, naam: stop.naam, stopId: stop.id });
    }
  }
  return { punten, rondrit: gegevens.r === 1, stijl: gegevens.s };
}

// Een route op het scherm zetten (uit een link of uit "Mijn routes")
function zetRoute({ punten, rondrit, stijl }) {
  routePunten = punten.map(p => {
    // Bars: altijd de actuele naam en plek gebruiken
    const stop = p.stopId ? alleStops.find(s => s.id === p.stopId) : null;
    return stop ? { lat: stop.lat, lng: stop.lng, naam: stop.naam, stopId: stop.id }
                : { lat: p.lat, lng: p.lng, naam: p.stopId ? p.naam : null, stopId: null };
  });
  routeRondrit = Boolean(rondrit);
  if (ROUTE_STIJLEN[stijl]) routeStijl = stijl;

  if (!routeModus) document.getElementById("routeKnop").click();   // Route plannen openen
  tekenStijlKnoppen();
  routeGewijzigd();
  if (routePunten.length) {
    kaart.fitBounds(L.latLngBounds(routePunten.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 14 });
  }
}

// ---------- Een gedeelde link openen ----------
// Staat er "#route=…" in het adres? Onthoud het, want misschien moet je eerst nog inloggen.
if (location.hash.startsWith("#route=")) {
  try { localStorage.setItem("gedeeldeRoute", location.hash.slice(7)); } catch {}
  history.replaceState(null, "", location.pathname + location.search);   // het adres weer proper maken
}

// Wordt opgeroepen door app.js zodra de bars geladen zijn en de kaart zichtbaar is
function openGedeeldeRoute() {
  let code = null;
  try { code = localStorage.getItem("gedeeldeRoute"); } catch {}
  if (!code || alleStops.length === 0 || document.getElementById("app").hidden) return;
  try { localStorage.removeItem("gedeeldeRoute"); } catch {}
  try {
    // Even wachten tot de kaart zijn plaats en grootte kent
    const route = codeNaarRoute(code);
    setTimeout(() => zetRoute(route), 50);
  } catch (fout) {
    console.error("Deze routelink klopt niet", fout);
  }
}

// ---------- Delen ----------
document.getElementById("routeDelen").onclick = async () => {
  if (routePunten.length < 2) return;
  const link = location.origin + location.pathname + "#route=" + routeNaarCode();
  const melding = document.getElementById("routeMelding");

  // Op een gsm: het deelmenu (WhatsApp, Messenger, …)
  if (navigator.share) {
    try {
      await navigator.share({ title: "Roast Route", text: t("deelTekst"), url: link });
      return;
    } catch (fout) {
      if (fout.name === "AbortError") return;   // zelf geannuleerd
    }
  }
  // Op een computer: de link kopiëren
  try {
    await navigator.clipboard.writeText(link);
    melding.textContent = t("linkGekopieerd");
  } catch {
    prompt(t("kopieerLink"), link);
  }
};

// ---------- Bewaren in je account ----------
document.getElementById("routeBewaar").onclick = async () => {
  if (!gebruiker) { alert(t("eerstInloggen")); return; }
  if (!routeLijn) return;
  const voorstel = t("routeStandaardNaam") + " " + routeLijn.km.toFixed(0) + " km";
  const naam = prompt(t("routeNaamVraag"), voorstel);
  if (naam === null) return;                     // geannuleerd

  try {
    await bewaarRouteInDatabase({
      naam: (naam.trim() || voorstel).slice(0, 80),
      punten: routePunten.map(p => ({ lat: p.lat, lng: p.lng, naam: p.naam, stopId: p.stopId })),
      rondrit: routeRondrit,
      stijl: routeStijl,
      km: Number(routeLijn.km.toFixed(1)),
      hoogtemeters: routeLijn.hoogtemeters
    });
    document.getElementById("routeMelding").textContent = t("routeBewaard");
    await laadMijnRoutes();
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
  }
};

// Wordt opgeroepen door app.js na het inloggen en uitloggen
async function laadMijnRoutes() {
  mijnRoutes = [];
  if (gebruiker) {
    try { mijnRoutes = await haalRoutesOp(); }
    catch (fout) { console.error(fout); }
  }
  tekenMijnRoutes();
}

function tekenMijnRoutes() {
  const blok = document.getElementById("mijnRoutes");
  document.getElementById("routeBewaar").hidden = !gebruiker;
  if (!gebruiker || mijnRoutes.length === 0) { blok.innerHTML = ""; return; }

  blok.innerHTML = `<strong>💾 ${t("mijnRoutes")}</strong>
    <ul>${mijnRoutes.map(r => `
      <li>
        <span><b>${esc(r.naam)}</b>
          <small>${String(r.km ?? "?").replace(".", ",")} km${r.hoogtemeters ? " · ↗ " + r.hoogtemeters + " hm" : ""}</small></span>
        <span class="knopjes">
          <button data-open="${r.id}">${t("routeOpenen")}</button>
          <button data-wisroute="${r.id}" aria-label="Verwijderen">✕</button>
        </span>
      </li>`).join("")}</ul>`;

  blok.querySelectorAll("[data-open]").forEach(knop => {
    knop.onclick = () => {
      const r = mijnRoutes.find(x => x.id === knop.dataset.open);
      zetRoute({ punten: r.punten, rondrit: r.rondrit, stijl: r.stijl });
    };
  });
  blok.querySelectorAll("[data-wisroute]").forEach(knop => {
    knop.onclick = async () => {
      if (!confirm(t("zekerRouteWissen"))) return;
      try {
        await verwijderRouteUitDatabase(knop.dataset.wisroute);
        mijnRoutes = mijnRoutes.filter(r => r.id !== knop.dataset.wisroute);
        tekenMijnRoutes();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
  });
}

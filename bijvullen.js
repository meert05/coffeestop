// =====================================================
//  BIJVULLEN – waar vul je je drinkbussen bij?
// =====================================================
//
// Voor routes vanaf 40 km. De app rekent uit wanneer je drinkbussen leeg zijn
// (standaard na ± 2 uur rijden, aan de snelheid van je fiets) en zoekt rond dat
// punt van je route plekken om bij te vullen:
//   💧 waterkranen · ⛽ tankstations · ✝️ kerkhoven (bijna altijd een kraan)
//   🥖 bakkers · ☕ de koffiebars van Waypour
// De plekken komen uit OpenStreetMap (via de Overpass-dienst).
// De gekozen plekken komen als 💧 op de kaart en als waypoint in je GPX.

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"       // reserve
];
const BIJVUL_MIN_KM = 40;          // kortere ritten: geen bijvulplanner
const BIJVUL_ZOEKSTRAAL = 400;     // m van de route
const BIJVUL_KEUZES = [1, 1.5, 2, 2.5, 3];   // om de hoeveel uur bijvullen

let bijvulUren = 2;
try { bijvulUren = Number(localStorage.getItem("bijvulUren")) || 2; } catch {}
if (!BIJVUL_KEUZES.includes(bijvulUren)) bijvulUren = 2;

let bijvulSleutel = null;          // voor welke route hebben we plekken opgehaald?
let bijvulPlekken = null;          // [{ id, soort, naam, lat, lng, uren }] of null (nog niet geladen)
let bijvulStatus = "";             // "" | "zoeken" | "fout"
let bijvulKeuze = {};              // stopnummer → id van de gekozen plek
let bijvulWachter = null;
let bijvulTeller = 0;

// Volgorde = voorkeur: kranen en tankstations zijn bijna altijd beschikbaar
const BIJVUL_SOORTEN = {
  kraan:       { icoon: "💧", rang: 0 },
  tankstation: { icoon: "⛽", rang: 0 },
  koffiebar:   { icoon: "☕", rang: 1 },
  kerkhof:     { icoon: "✝️", rang: 1 },
  bakker:      { icoon: "🥖", rang: 2 }
};

// ---------- Hulpjes ----------
function routeSleutel(lijn) {
  const a = lijn.punten[0], b = lijn.punten[lijn.punten.length - 1];
  return [lijn.km.toFixed(2), lijn.punten.length, a[0].toFixed(4), a[1].toFixed(4), b[0].toFixed(4), b[1].toFixed(4)].join("|");
}

// Afgelegde km bij elk punt van de route
function cumulatieveKm(punten) {
  const km = [0];
  for (let i = 1; i < punten.length; i++) km.push(km[i - 1] + afstandKm(punten[i - 1], punten[i]));
  return km;
}

// Waar ligt een plek t.o.v. de route? → { afstand (km tot de route), km (hoe ver langs de route) }
function positieOpRoute(lat, lng, punten, cum) {
  const kLat = 111.32, kLng = 111.32 * Math.cos(lat * Math.PI / 180);
  const px = lng * kLng, py = lat * kLat;
  let beste = { afstand: Infinity, km: 0 };
  for (let i = 0; i < punten.length - 1; i++) {
    const ax = punten[i][1] * kLng, ay = punten[i][0] * kLat;
    const bx = punten[i + 1][1] * kLng, by = punten[i + 1][0] * kLat;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let f = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    f = Math.max(0, Math.min(1, f));
    const d = Math.hypot(px - (ax + f * dx), py - (ay + f * dy));
    if (d < beste.afstand) beste = { afstand: d, km: cum[i] + f * (cum[i + 1] - cum[i]) };
  }
  return beste;
}

// Elke ± 0,5 km een punt van de route (hooguit 300), om de zoekvraag klein te houden
function routeStaal(punten, cum) {
  const stap = Math.max(0.5, cum[cum.length - 1] / 300);
  const uit = [punten[0]];
  let volgende = stap;
  for (let i = 1; i < punten.length; i++) {
    if (cum[i] >= volgende) { uit.push(punten[i]); volgende = cum[i] + stap; }
  }
  uit.push(punten[punten.length - 1]);
  return uit;
}

function urenTekst(uren) {
  const u = Math.floor(uren), m = Math.round((uren - u) * 60);
  const teken = taal === "nl" ? "u" : "h";
  return u + teken + (m ? String(m).padStart(2, "0") : "");
}

function kmTekst(km) {
  return Math.round(km).toString();
}

// =====================================================
//  1. PLEKKEN OPHALEN UIT OPENSTREETMAP
// =====================================================
async function haalBijvulPlekken(lijn, sleutel) {
  const mijnBeurt = ++bijvulTeller;
  bijvulStatus = "zoeken";
  tekenBijvullen();

  const cum = cumulatieveKm(lijn.punten);
  const lijst = routeStaal(lijn.punten, cum).map(p => p[0].toFixed(5) + "," + p[1].toFixed(5)).join(",");
  const rond = `(around:${BIJVUL_ZOEKSTRAAL},${lijst})`;
  const vraag = `[out:json][timeout:25];
(
  node${rond}[amenity~"^(drinking_water|water_point|fuel)$"];
  way${rond}[amenity=fuel];
  nwr${rond}[shop=bakery];
  nwr${rond}[landuse=cemetery];
  nwr${rond}[amenity=grave_yard];
);
out center tags;`;

  let data = null;
  for (const server of OVERPASS) {
    try {
      const antwoord = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(vraag)
      });
      if (!antwoord.ok) throw new Error("Overpass " + antwoord.status);
      data = await antwoord.json();
      break;
    } catch (fout) {
      console.warn("Bijvulpunten: server lukte niet", server, fout);
    }
  }
  if (mijnBeurt !== bijvulTeller || sleutel !== bijvulSleutel) return;   // intussen een andere route

  if (!data) {
    bijvulStatus = "fout";
    bijvulPlekken = null;
  } else {
    bijvulStatus = "";
    bijvulPlekken = leesOverpass(data.elements || []);
  }
  tekenBijvullen();
  tekenRouteOpKaart();
}

// Overpass-antwoord → onze eigen plekken
function leesOverpass(elementen) {
  const plekken = [];
  const gezien = new Set();
  for (const el of elementen) {
    const tags = el.tags || {};
    const lat = el.lat !== undefined ? el.lat : el.center && el.center.lat;
    const lng = el.lon !== undefined ? el.lon : el.center && el.center.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (tags.access === "private" || tags.access === "no" || tags.drinking_water === "no") continue;

    let soort = null;
    if (tags.amenity === "drinking_water" || tags.amenity === "water_point") soort = "kraan";
    else if (tags.amenity === "fuel") soort = "tankstation";
    else if (tags.shop === "bakery") soort = "bakker";
    else if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") soort = "kerkhof";
    if (!soort) continue;

    const id = el.type + "/" + el.id;
    if (gezien.has(id)) continue;
    gezien.add(id);
    plekken.push({
      id, soort, lat, lng,
      naam: String(tags.name || tags.brand || tags.operator || "").slice(0, 60),
      uren: String(tags.opening_hours || "").slice(0, 60)
    });
  }
  return plekken;
}

// =====================================================
//  2. DE BIJVULSTOPS BEREKENEN
// =====================================================
// → { intervalKm, stops: [{ nr, km, opties: [...] }] }
function berekenBijvulStops() {
  const lijn = routeLijn;
  const intervalKm = bijvulUren * routeSnelheid;
  const totaal = lijn.km;
  const cum = cumulatieveKm(lijn.punten);

  // Alle kandidaten met hun plek langs de route
  const kandidaten = [];
  for (const p of bijvulPlekken || []) {
    const pos = positieOpRoute(p.lat, p.lng, lijn.punten, cum);
    if (pos.afstand <= 0.5) kandidaten.push({ ...p, ...pos });
  }
  for (const stop of alleStops) {
    const pos = positieOpRoute(stop.lat, stop.lng, lijn.punten, cum);
    if (pos.afstand <= 0.5) {
      kandidaten.push({ id: "bar/" + stop.id, soort: "koffiebar", naam: stop.naam, lat: stop.lat, lng: stop.lng, uren: "", ...pos });
    }
  }

  const stops = [];
  let vorige = 0;
  for (let doel = intervalKm, nr = 1; doel < totaal - 10; doel += intervalKm, nr++) {
    // Liefst iets vóór het doel (dan zijn je drinkbussen nog niet leeg)
    const zoek = (voor, na) => kandidaten.filter(k => k.km >= Math.max(vorige + 5, doel - voor) && k.km <= doel + na);
    let opties = zoek(12, 4);
    if (opties.length === 0) opties = zoek(20, 8);
    opties = opties
      .map(k => ({ ...k, score: Math.abs(k.km - doel) + 3 * BIJVUL_SOORTEN[k.soort].rang + 5 * k.afstand + (k.km > doel ? 2 : 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    stops.push({ nr, km: doel, opties });
    const gekozen = opties.find(o => o.id === bijvulKeuze[nr]) || opties[0];
    vorige = gekozen ? gekozen.km : doel;
  }
  return { intervalKm, stops };
}

// De plekken die nu gekozen zijn (voor de kaart en de GPX)
function gekozenBijvulPlekken() {
  if (!bijvulActief() || !bijvulPlekken) return [];
  return berekenBijvulStops().stops
    .map(s => s.opties.find(o => o.id === bijvulKeuze[s.nr]) || s.opties[0])
    .filter(Boolean);
}

function bijvulActief() {
  return routeModus && routeLijn && routeLijn.km >= BIJVUL_MIN_KM;
}

function bijvulNaam(plek) {
  return plek.naam || t("bijvul_" + plek.soort);
}

// =====================================================
//  3. HET BLOK "BIJVULLEN" IN HET ROUTEPANEEL
// =====================================================
function tekenBijvullen() {
  const blok = document.getElementById("routeBijvullen");
  if (!blok) return;
  if (!bijvulActief()) { blok.innerHTML = ""; return; }

  // Nieuwe route? Even wachten tot ze stilstaat, dan de plekken ophalen
  const sleutel = routeSleutel(routeLijn);
  if (sleutel !== bijvulSleutel) {
    bijvulSleutel = sleutel;
    bijvulPlekken = null;
    bijvulKeuze = {};
    bijvulStatus = "zoeken";
    clearTimeout(bijvulWachter);
    const lijn = routeLijn;
    bijvulWachter = setTimeout(() => haalBijvulPlekken(lijn, sleutel), 800);
  }

  const kop = `<strong>💧 ${t("bijvullen")}</strong>
    <div class="bijvulInstelling">
      <label>${t("bijvulElke")}
        <select id="bijvulUren">${BIJVUL_KEUZES.map(u =>
          `<option value="${u}" ${u === bijvulUren ? "selected" : ""}>${urenTekst(u)}</option>`).join("")}
        </select>
      </label>
      <small>± ${kmTekst(bijvulUren * routeSnelheid)} km ${t("aan")} ${routeSnelheid} km/u</small>
    </div>`;

  let inhoud;
  if (bijvulStatus === "zoeken") {
    inhoud = `<p class="leeg">${t("bijvulZoeken")}</p>`;
  } else if (bijvulStatus === "fout") {
    inhoud = `<p class="leeg">${t("bijvulFout")} <button type="button" id="bijvulOpnieuw" class="link">${t("bijvulOpnieuw")}</button></p>`;
  } else {
    const { stops } = berekenBijvulStops();
    if (stops.length === 0) {
      inhoud = `<p class="leeg">${t("bijvulKort").replace("{u}", urenTekst(bijvulUren))}</p>`;
    } else {
      inhoud = stops.map(s => {
        const gekozen = (s.opties.find(o => o.id === bijvulKeuze[s.nr]) || s.opties[0] || {}).id;
        const titel = `<b class="bijvulStop">${t("bijvulStop").replace("{n}", s.nr).replace("{km}", kmTekst(s.km))}</b>`;
        if (s.opties.length === 0) {
          return titel + `<p class="leeg">${t("bijvulGeen")}</p>`;
        }
        return titel + `<ul>${s.opties.map(o => `
          <li class="${o.id === gekozen ? "gekozen" : ""}">
            <span><b>${BIJVUL_SOORTEN[o.soort].icoon} ${esc(bijvulNaam(o))}</b>
            <small>km ${kmTekst(o.km)} · ${o.afstand < 0.05 ? t("opDeRoute") : Math.round(o.afstand * 1000) + " m " + t("bijvulVanRoute")}${o.naam ? " · " + t("bijvul_" + o.soort) : ""}${o.uren ? " · " + esc(o.uren) : ""}</small></span>
            <button type="button" data-bijvul="${s.nr}" data-plek="${esc(o.id)}" ${o.id === gekozen ? "disabled" : ""}>${o.id === gekozen ? "✓" : t("bijvulKies")}</button>
          </li>`).join("")}</ul>`;
      }).join("") + `<p class="bron">${t("bijvulBron")}</p>`;
    }
  }
  blok.innerHTML = kop + inhoud;

  blok.querySelector("#bijvulUren").onchange = (event) => {
    bijvulUren = Number(event.target.value);
    try { localStorage.setItem("bijvulUren", String(bijvulUren)); } catch {}
    bijvulKeuze = {};
    tekenBijvullen();
    tekenRouteOpKaart();
  };
  const opnieuw = blok.querySelector("#bijvulOpnieuw");
  if (opnieuw) opnieuw.onclick = () => { bijvulSleutel = null; tekenBijvullen(); };
  blok.querySelectorAll("[data-bijvul]").forEach(knop => {
    knop.onclick = () => {
      bijvulKeuze[Number(knop.dataset.bijvul)] = knop.dataset.plek;
      tekenBijvullen();
      tekenRouteOpKaart();
    };
  });
}

// =====================================================
//  4. OP DE KAART EN IN DE GPX
// =====================================================
// Wordt opgeroepen door tekenRouteOpKaart() in route.js
function tekenBijvulOpKaart(laag) {
  for (const p of gekozenBijvulPlekken()) {
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: "routePunt water", html: "💧", iconSize: [26, 26] })
    }).bindTooltip(esc(bijvulNaam(p)) + " · km " + kmTekst(p.km)).addTo(laag);
  }
}

// Waypoints voor de GPX (Garmin, Wahoo, … tonen ze onderweg)
function bijvulWaypoints(xml) {
  return gekozenBijvulPlekken().map(p =>
    `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>💧 ${xml(bijvulNaam(p))} (km ${kmTekst(p.km)})</name><sym>Drinking Water</sym></wpt>`
  ).join("\n");
}

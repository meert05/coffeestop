// =====================================================
//  BIJVULLEN – waar vul je je drinkbussen bij?
// =====================================================
//
// Voor routes vanaf 40 km. De app rekent uit wanneer je drinkbussen leeg zijn
// (standaard na ± 2 uur rijden, aan de snelheid van je fiets) en zoekt rond dat
// punt van je route plekken om bij te vullen:
//   💧 waterkranen · ⛽ tankstations
//   🥖 bakkers · ☕ de koffiebars van Waypour
// De plekken komen uit OpenStreetMap (via de Overpass-dienst), aangevuld met
// de eigen bijvulpunten van de beheerder (tabel "bijvulpunten" in Supabase).
// Die eigen punten zie je nergens anders: alleen hier, als je een route plant.
// Jij kiest zelf: met ➕ komt een plek in je route (de route loopt er dan langs),
// als 💧 op de kaart en als waypoint in je GPX.

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

let bijvulSleutel = null;          // voor welke route hebben we gekeken?
let bijvulPlekken = null;          // [{ id, soort, naam, lat, lng, uren }] of null (nog niet geladen)
let bijvulGebied = [];             // de routepunten waarrond we al zochten (zo vragen we niet alles opnieuw)
let bijvulStatus = "";             // "" | "zoeken" | "fout"
let bijvulWachter = null;
let bijvulTeller = 0;

let eigenBijvulpunten = null;      // de punten van de beheerder (uit de database), null = nog niet geladen
let eigenBijvulVoor = undefined;   // voor welke gebruiker geladen
let bijvulNieuw = null;            // beheerder: null | { stap: "klik" } | { stap: "formulier", lat, lng }

// Volgorde = voorkeur: kranen en tankstations zijn bijna altijd beschikbaar
const BIJVUL_SOORTEN = {
  kraan:       { icoon: "💧", rang: 0 },
  tankstation: { icoon: "⛽", rang: 0 },
  koffiebar:   { icoon: "☕", rang: 1 },
  bakker:      { icoon: "🥖", rang: 2 },
  cafe:        { icoon: "🍺", rang: 1 },
  andere:      { icoon: "📍", rang: 1 }
};
const EIGEN_SOORTEN = ["kraan", "tankstation", "bakker", "cafe", "andere"];

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
  const staal = routeStaal(lijn.punten, cum);
  const lijst = staal.map(p => p[0].toFixed(5) + "," + p[1].toFixed(5)).join(",");
  const rond = `(around:${BIJVUL_ZOEKSTRAAL},${lijst})`;
  const vraag = `[out:json][timeout:25];
(
  node${rond}[amenity~"^(drinking_water|water_point|fuel)$"];
  way${rond}[amenity=fuel];
  nwr${rond}[shop=bakery];
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
    bijvulGebied = staal;
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

// Hebben we rond deze route al gezocht? (bv. na het toevoegen van een kleine omweg)
function bijvulGedekt(lijn) {
  if (!bijvulPlekken || bijvulGebied.length === 0) return false;
  const staal = routeStaal(lijn.punten, cumulatieveKm(lijn.punten));
  return staal.every(p => bijvulGebied.some(q => afstandKm(p, q) < 0.4));
}

// Zit deze plek al in je route?
function bijvulInRoute(plek) {
  if (plek.soort === "koffiebar") {
    const stop = alleStops.find(s => "bar/" + s.id === plek.id);
    return stop ? barInRoute(stop) : false;
  }
  if (routeImport) return routeImport.omwegen.some(o => o.stopId === plek.id);
  return routePunten.some(p => p.bijvulId === plek.id);
}

// ➕ / ✓ : een plek in je route zetten of er weer uit halen
function wisselBijvulInRoute(plek) {
  if (plek.soort === "koffiebar") {
    const stop = alleStops.find(s => "bar/" + s.id === plek.id);
    if (stop) wisselBarInRoute(stop);
    return;
  }
  const naam = BIJVUL_SOORTEN[plek.soort].icoon + " " + bijvulNaam(plek);
  if (routeImport) {
    wisselOmweg({ id: plek.id, naam, lat: plek.lat, lng: plek.lng, bijvul: true });
    return;
  }
  if (bijvulInRoute(plek)) {
    routePunten = routePunten.filter(p => p.bijvulId !== plek.id);
  } else {
    voegInOpBesteplek({ lat: plek.lat, lng: plek.lng, naam, stopId: null, bijvulId: plek.id });
  }
  routeGewijzigd();
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
  for (const p of eigenBijvulpunten || []) {
    const pos = positieOpRoute(p.lat, p.lng, lijn.punten, cum);
    if (pos.afstand <= 0.5) {
      kandidaten.push({ id: "eigen/" + p.id, soort: BIJVUL_SOORTEN[p.soort] ? p.soort : "andere", naam: p.naam,
                        info: p.info || "", foto: /^https:\/\//.test(p.foto || "") ? p.foto : "", eigen: true, lat: p.lat, lng: p.lng, uren: "", ...pos });
    }
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
      .map(k => ({ ...k, score: Math.abs(k.km - doel) + 3 * (k.eigen ? -1 : BIJVUL_SOORTEN[k.soort].rang) + 5 * k.afstand + (k.km > doel ? 2 : 0) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
    stops.push({ nr, km: doel, opties });
    const gekozen = opties.find(bijvulInRoute);
    vorige = gekozen ? gekozen.km : doel;
  }
  return { intervalKm, stops };
}

// De bijvulpunten die in je route zitten (voor de GPX)
function bijvulPuntenInRoute() {
  if (routeImport) return routeImport.omwegen.filter(o => o.bijvul);
  return routePunten.filter(p => p.bijvulId);
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
  laadEigenBijvulpunten();
  tekenBijvulBeheer();
  const blok = document.getElementById("routeBijvullen");
  if (!blok) return;
  if (!bijvulActief()) { blok.innerHTML = ""; return; }

  // Nieuwe route? Even wachten tot ze stilstaat, dan de plekken ophalen
  const sleutel = routeSleutel(routeLijn);
  if (sleutel !== bijvulSleutel) {
    bijvulSleutel = sleutel;
    clearTimeout(bijvulWachter);
    if (!bijvulGedekt(routeLijn)) {
      bijvulPlekken = null;
      bijvulGebied = [];
      bijvulStatus = "zoeken";
      const lijn = routeLijn;
      bijvulWachter = setTimeout(() => haalBijvulPlekken(lijn, sleutel), 800);
    }
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
      inhoud = `<p class="leeg">${t("bijvulUitleg")}</p>` + stops.map(s => {
        const titel = `<b class="bijvulStop">${t("bijvulStop").replace("{n}", s.nr).replace("{km}", kmTekst(s.km))}</b>`;
        if (s.opties.length === 0) {
          return titel + `<p class="leeg">${t("bijvulGeen")}</p>`;
        }
        return titel + `<ul>${s.opties.map(o => `
          <li class="${bijvulInRoute(o) ? "gekozen" : ""}">
            ${o.foto ? `<img class="bijvulFoto" src="${esc(o.foto)}" alt="" loading="lazy">` : ""}
            <span><b>${BIJVUL_SOORTEN[o.soort].icoon} ${esc(bijvulNaam(o))}</b>
            <small>${o.eigen ? "★ " + t("bijvulTip") + " · " : ""}km ${kmTekst(o.km)} · ${o.afstand < 0.05 ? t("opDeRoute") : Math.round(o.afstand * 1000) + " m " + t("bijvulVanRoute")}${o.naam ? " · " + t("bijvul_" + o.soort) : ""}${o.uren ? " · " + esc(o.uren) : ""}${o.info ? " · " + esc(o.info) : ""}</small></span>
            <button type="button" data-plek="${esc(o.id)}" class="${bijvulInRoute(o) ? "actief" : ""}"
              aria-label="${bijvulInRoute(o) ? t("inRoute") : t("naarRoute")}">${bijvulInRoute(o) ? "✓" : "➕"}</button>
          </li>`).join("")}</ul>`;
      }).join("") + `<p class="bron">${t("bijvulBron")}</p>`;
    }
  }
  blok.innerHTML = kop + inhoud;

  blok.querySelector("#bijvulUren").onchange = (event) => {
    bijvulUren = Number(event.target.value);
    try { localStorage.setItem("bijvulUren", String(bijvulUren)); } catch {}
    tekenBijvullen();
  };
  const opnieuw = blok.querySelector("#bijvulOpnieuw");
  if (opnieuw) opnieuw.onclick = () => { bijvulSleutel = null; tekenBijvullen(); };
  blok.querySelectorAll("[data-plek]").forEach(knop => {
    knop.onclick = () => {
      const plek = alleBijvulOpties().find(o => o.id === knop.dataset.plek);
      if (plek) wisselBijvulInRoute(plek);
    };
  });
}

// Alle opties die nu op het scherm staan
function alleBijvulOpties() {
  if (!bijvulActief() || !bijvulPlekken) return [];
  return berekenBijvulStops().stops.flatMap(s => s.opties);
}

// =====================================================
//  4. IN DE GPX
// =====================================================
// Waypoints voor de GPX (Garmin, Wahoo, … tonen ze onderweg)
function bijvulWaypoints(xml) {
  return bijvulPuntenInRoute().map(p =>
    `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>${xml(p.naam)}</name><sym>Drinking Water</sym></wpt>`
  ).join("\n");
}

// =====================================================
//  5. EIGEN BIJVULPUNTEN (uit de database)
// =====================================================
// Alleen ingelogde gebruikers kunnen ze lezen; alleen de beheerder kan ze toevoegen of wissen.
async function laadEigenBijvulpunten(opnieuw = false) {
  const wie = gebruiker ? gebruiker.id : null;
  if (!opnieuw && eigenBijvulVoor === wie) return;
  eigenBijvulVoor = wie;
  eigenBijvulpunten = [];
  if (!wie) return;
  try {
    eigenBijvulpunten = await haalBijvulpuntenOp();
  } catch (fout) {
    console.error("Eigen bijvulpunten laden lukte niet", fout);   // bv. tabel nog niet aangemaakt
    eigenBijvulpunten = [];
  }
  if (routeModus) { tekenBijvullen(); tekenRouteOpKaart(); }
}

// =====================================================
//  6. BEHEER: EIGEN BIJVULPUNTEN TOEVOEGEN EN WISSEN (alleen de beheerder)
// =====================================================
// Zoals bij de koffiebars: naam, soort, adres (de app zoekt het op de kaart),
// een tekstje en een foto. Je kan de plek ook aanklikken of het speldje verslepen.

function tekenBijvulBeheer() {
  const blok = document.getElementById("bijvulBeheer");
  if (!blok) return;
  if (!routeModus || !isBeheerder()) { blok.innerHTML = ""; bijvulNieuw = null; return; }
  if (bijvulNieuw && blok.querySelector("#bijvulFormulier")) return;   // formulier staat al open: niet wissen

  const aantal = (eigenBijvulpunten || []).length;
  let inhoud = `<strong>💧 ${t("bijvulBeheer")}</strong>
    <p class="leeg">${t("bijvulBeheerUitleg").replace("{n}", aantal)}</p>`;

  if (!bijvulNieuw) {
    blok.innerHTML = inhoud + `<button type="button" id="bijvulNieuwKnop">${t("bijvulNieuw")}</button>`;
    blok.querySelector("#bijvulNieuwKnop").onclick = () => {
      bijvulNieuw = { lat: null, lng: null };
      tekenBijvulBeheer();
    };
    return;
  }

  blok.innerHTML = inhoud + `<form id="bijvulFormulier" class="bijvulFormulier">
      <input id="bijvulNaam" maxlength="80" required placeholder="${t("bijvulNaamVoorbeeld")}">
      <select id="bijvulSoort">${EIGEN_SOORTEN.map(s =>
        `<option value="${s}">${BIJVUL_SOORTEN[s].icoon} ${t("bijvul_" + s)}</option>`).join("")}</select>
      <div class="adresRij">
        <input id="bijvulAdres" maxlength="200" placeholder="${t("adres")}">
        <button type="button" id="bijvulZoekAdres">${t("zoekOpKaart")}</button>
      </div>
      <small id="bijvulPlek">${t("bijvulPlekUitleg")}</small>
      <textarea id="bijvulInfo" maxlength="200" rows="2" placeholder="${t("bijvulInfoVoorbeeld")}"></textarea>
      <label class="knopLabel">
        <span id="bijvulFotoTekst">📷 ${t("bijvulFotoKiezen")}</span>
        <input id="bijvulFoto" type="file" accept="image/*">
      </label>
      <div class="routeKnoppen">
        <button type="submit">${t("bijvulBewaren")}</button>
        <button type="button" id="bijvulAnnuleer" class="link">${t("bijvulAnnuleren")}</button>
      </div>
    </form>`;

  const formulier = blok.querySelector("#bijvulFormulier");
  const plekTekst = formulier.querySelector("#bijvulPlek");
  formulier.querySelector("#bijvulNaam").focus();
  toonBijvulPlek();

  // Adres opzoeken op de kaart (OpenStreetMap), net zoals bij een nieuwe bar
  formulier.querySelector("#bijvulZoekAdres").onclick = async () => {
    const adres = formulier.querySelector("#bijvulAdres").value.trim();
    if (!adres) { plekTekst.textContent = t("eerstAdres"); return; }
    plekTekst.textContent = t("adresZoeken");
    try {
      const gevonden = await zoekAdres(adres);
      if (!gevonden) { plekTekst.textContent = t("adresNietGevonden"); return; }
      zetBijvulPlek(gevonden.lat, gevonden.lng, gevonden.plaats);
      kaart.setView([gevonden.lat, gevonden.lng], 17);
    } catch (fout) {
      console.error(fout);
      plekTekst.textContent = t("adresNietGevonden");
    }
  };

  // Foto gekozen: de naam tonen
  formulier.querySelector("#bijvulFoto").onchange = (event) => {
    const bestand = event.target.files[0];
    formulier.querySelector("#bijvulFotoTekst").textContent = bestand ? "📷 " + bestand.name : "📷 " + t("bijvulFotoKiezen");
  };

  formulier.querySelector("#bijvulAnnuleer").onclick = () => {
    bijvulNieuw = null;
    blok.innerHTML = "";
    tekenBijvulBeheer();
    tekenRouteOpKaart();
  };

  formulier.onsubmit = async (event) => {
    event.preventDefault();
    if (bijvulNieuw.lat === null) { plekTekst.textContent = t("bijvulEerstPlek"); return; }
    const knop = formulier.querySelector("button[type=submit]");
    knop.disabled = true;
    const punt = {
      naam: formulier.querySelector("#bijvulNaam").value.trim().slice(0, 80),
      soort: formulier.querySelector("#bijvulSoort").value,
      adres: formulier.querySelector("#bijvulAdres").value.trim().slice(0, 200) || null,
      info: formulier.querySelector("#bijvulInfo").value.trim().slice(0, 200) || null,
      lat: Number(bijvulNieuw.lat.toFixed(6)),
      lng: Number(bijvulNieuw.lng.toFixed(6))
    };
    if (!punt.naam || !EIGEN_SOORTEN.includes(punt.soort)) { knop.disabled = false; return; }
    try {
      const foto = formulier.querySelector("#bijvulFoto").files[0];
      if (foto) {
        plekTekst.textContent = t("fotoBezig");
        punt.foto = await uploadFoto(await verkleinFoto(foto), "bijvulpunt-" + maakId(punt.naam));
      }
      const bewaard = await bewaarBijvulpunt(punt);
      eigenBijvulpunten = [...(eigenBijvulpunten || []), bewaard || punt];
      bijvulNieuw = null;
      blok.innerHTML = "";
      document.getElementById("routeMelding").textContent = t("bijvulBewaard");
      tekenBijvullen();
      tekenRouteOpKaart();
    } catch (fout) {
      knop.disabled = false;
      alert(t("opslaanMislukt") + " " + fout.message);
    }
  };
}

// De gekozen plek onthouden en tonen (zonder het formulier te wissen)
function zetBijvulPlek(lat, lng, plaats = "") {
  if (!bijvulNieuw) return;
  bijvulNieuw.lat = lat;
  bijvulNieuw.lng = lng;
  bijvulNieuw.plaats = plaats;
  toonBijvulPlek();
  tekenRouteOpKaart();
}

function toonBijvulPlek() {
  const plekTekst = document.getElementById("bijvulPlek");
  if (!plekTekst || !bijvulNieuw) return;
  plekTekst.textContent = bijvulNieuw.lat === null
    ? t("bijvulPlekUitleg")
    : "📍 " + (bijvulNieuw.plaats ? bijvulNieuw.plaats + " · " : "") +
      bijvulNieuw.lat.toFixed(5) + ", " + bijvulNieuw.lng.toFixed(5) + " · " + t("bijvulVersleep");
}

// Wordt opgeroepen door route.js bij een klik op de kaart. true = wij handelen de klik af.
function bijvulKaartKlik(event) {
  if (!bijvulNieuw || !isBeheerder()) return false;
  zetBijvulPlek(event.latlng.lat, event.latlng.lng);
  return true;
}

// Beheerder: alle eigen punten op de kaart (klik = verwijderen), plus het nieuwe punt
function tekenBijvulBeheerOpKaart(laag) {
  if (!routeModus || !isBeheerder()) return;
  for (const p of eigenBijvulpunten || []) {
    const soort = BIJVUL_SOORTEN[p.soort] ? p.soort : "andere";
    const speld = L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: "routePunt eigenPunt", html: BIJVUL_SOORTEN[soort].icoon, iconSize: [24, 24] })
    }).bindTooltip(esc(p.naam) + (p.info ? " · " + esc(p.info) : "") + " · " + t("bijvulKlikWissen")).addTo(laag);
    speld.on("click", async () => {
      if (!confirm(t("bijvulWisVraag").replace("{naam}", p.naam))) return;
      try {
        await verwijderBijvulpunt(p.id);
        eigenBijvulpunten = eigenBijvulpunten.filter(x => x.id !== p.id);
        tekenBijvullen();
        tekenRouteOpKaart();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    });
  }
  // Het nieuwe punt: verslepen om de plek precies goed te zetten
  if (bijvulNieuw && bijvulNieuw.lat !== null) {
    const nieuw = L.marker([bijvulNieuw.lat, bijvulNieuw.lng], {
      draggable: true,
      icon: L.divIcon({ className: "routePunt eigenPunt nieuw", html: "＋", iconSize: [24, 24] })
    }).addTo(laag);
    nieuw.on("dragend", () => {
      const plek = nieuw.getLatLng();
      zetBijvulPlek(plek.lat, plek.lng, bijvulNieuw.plaats);
    });
  }
}

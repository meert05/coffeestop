// =====================================================
//  ROUTE PLANNEN – een fietsroute langs koffiebars
// =====================================================
//
// Twee manieren:
//  A. Zelf plannen: klik punten op de kaart en klik bars aan. De app berekent
//     een fietsroute over echte wegen (BRouter, met reserve).
//  B. Eigen GPX inladen (Strava, Garmin, Komoot, …): je route blijft zoals ze is,
//     en je kan koffiebars toevoegen met een kleine omweg (max. 2 km). De app
//     berekent dan een echte fietsomweg naar de bar en terug naar je route.
//
// Daarna: GPX downloaden, delen via een link, bewaren in je account.
// De beheerder kan routes publiceren: dan ziet iedereen ze.

const BROUTER = "https://brouter.de/brouter";
const RESERVE_SERVER = "https://routing.openstreetmap.de/routed-bike/route/v1/driving/";

// De fietsstijlen en het BRouter-profiel dat erbij hoort
const ROUTE_STIJLEN = {
  snel: "fastbike",                        // vlot over asfalt, koersfiets
  fietspaden: "trekking",                  // fietspaden, knooppunten, fietssnelwegen
  rustig: "fastbike-verylowtraffic"        // zo weinig mogelijk verkeer
};

let routeSnelheid = 25;          // km/u, om de rijtijd te schatten (aan te passen in je profiel)
const MAX_OMWEG_KM = 2;          // bars met hooguit zoveel omweg (heen en terug) tonen we als tip

let routeModus = false;          // staat "Route plannen" aan?
let routeStijl = "fietspaden";
let routePunten = [];            // zelf gepland: [{ lat, lng, naam, stopId }] in volgorde
let routeRondrit = false;        // zelf gepland: terug naar het startpunt?
let routeImport = null;          // ingeladen GPX: { naam, spoor: [[lat, lng, hoogte], …], omwegen: [...] }
let routeBron = null;            // de bewaarde route die open staat: { id, publiek }
let routeLijn = null;            // wat op de kaart staat: { punten: [[lat, lng, hoogte], …], km, hoogtemeters }
let routeTeller = 0;             // om oude antwoorden van de server te negeren

// Een eigen laag onder de stippen, zodat de bars bovenop de route liggen
kaart.createPane("routeLaag");
kaart.getPane("routeLaag").style.zIndex = 350;
const routeLaag = L.layerGroup().addTo(kaart);

// =====================================================
//  1. AAN- EN UITZETTEN, KLIKKEN OP DE KAART
// =====================================================
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

// Klikken op de kaart: een punt toevoegen (niet bij een ingeladen GPX)
kaart.on("click", (event) => {
  if (!routeModus) return;
  if (routeImport) {
    document.getElementById("routeMelding").textContent = t("importKlik");
    return;
  }
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

// =====================================================
//  2. ONGEDAAN MAKEN
// =====================================================
// Voor elke wijziging bewaren we een kopie van hoe het ervoor stond.
let geschiedenis = [];
let laatsteToestand = momentopname();

function momentopname() {
  return {
    punten: routePunten.map(p => ({ ...p })),
    rondrit: routeRondrit,
    import: routeImport ? { ...routeImport, omwegen: [...routeImport.omwegen] } : null,
    bron: routeBron
  };
}

function herstel(toestand) {
  routePunten = toestand.punten.map(p => ({ ...p }));
  routeRondrit = toestand.rondrit;
  routeImport = toestand.import ? { ...toestand.import, omwegen: [...toestand.import.omwegen] } : null;
  routeBron = toestand.bron;
}

document.getElementById("routeTerug").onclick = () => {
  if (geschiedenis.length === 0) return;
  herstel(geschiedenis.pop());
  laatsteToestand = momentopname();
  hertekenEnBereken();
};

// Er veranderde iets: onthouden voor "ongedaan maken", alles opnieuw tekenen en berekenen.
// opties.bron: de bewaarde route die we net openden (anders vergeten we de bron,
// want een aangepaste route is niet meer dezelfde als de bewaarde)
function routeGewijzigd(opties = {}) {
  routeBron = opties.bron || null;
  geschiedenis.push(laatsteToestand);
  if (geschiedenis.length > 30) geschiedenis.shift();
  laatsteToestand = momentopname();
  hertekenEnBereken();
}

function hertekenEnBereken() {
  if (routeImport) routeLijn = samengevoegdeLijn();
  tekenRoutePaneel();
  tekenRouteOpKaart();
  teken();
  if (!routeImport) berekenRoute();
}

// =====================================================
//  3. BARS TOEVOEGEN EN VERWIJDEREN
// =====================================================
function barInRoute(stop) {
  if (routeImport) return routeImport.omwegen.some(o => o.stopId === stop.id);
  return routePunten.some(p => p.stopId === stop.id);
}

function wisselBarInRoute(stop) {
  if (routeImport) { wisselOmweg(stop); return; }
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

// =====================================================
//  4. DE ROUTE BEREKENEN (zelf gepland)
// =====================================================
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

  const { lijn, reserve } = await vraagLijn(punten);
  if (mijnBeurt !== routeTeller) return;          // er kwam intussen een nieuwere vraag
  routeLijn = lijn;
  melding.textContent = !lijn ? t("routeMislukt") : reserve ? t("routeReserve") : "";
  tekenRouteOpKaart();
  tekenRoutePaneel();
}

// Een fietsroute langs deze punten: eerst BRouter, anders de reserve
async function vraagLijn(punten) {
  try {
    return { lijn: await vraagBRouter(punten), reserve: false };
  } catch (fout) {
    console.warn("BRouter lukte niet, we proberen de reserve", fout);
    try {
      return { lijn: await vraagReserve(punten), reserve: true };
    } catch (fout2) {
      console.error(fout2);
      return { lijn: null, reserve: true };
    }
  }
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
      if (!routeImport) berekenRoute();   // bij een GPX geldt de stijl voor nieuwe omwegen
    };
    rij.appendChild(knop);
  }
}

// =====================================================
//  5. VOLGORDE OPTIMALISEREN
// =====================================================
// De start blijft de start (en het einde het einde, behalve bij een rondrit).
// De punten ertussen zetten we in de kortste volgorde.
document.getElementById("routeOptimaliseer").onclick = () => {
  if (!kanOptimaliseren()) return;
  const d = (a, b) => afstandKm([a.lat, a.lng], [b.lat, b.lng]);
  const eindVast = !routeRondrit;
  const begin = routePunten[0];
  const eind = eindVast ? routePunten[routePunten.length - 1] : begin;
  const rest = routePunten.slice(1, eindVast ? -1 : undefined);

  // Stap 1: telkens naar het dichtstbijzijnde punt
  const pad = [begin];
  while (rest.length) {
    const huidig = pad[pad.length - 1];
    let beste = 0;
    rest.forEach((p, i) => { if (d(huidig, p) < d(huidig, rest[beste])) beste = i; });
    pad.push(rest.splice(beste, 1)[0]);
  }
  pad.push(eind);

  // Stap 2: kruisende stukken ontwarren ("2-opt")
  let verbeterd = true;
  while (verbeterd) {
    verbeterd = false;
    for (let i = 1; i < pad.length - 2; i++) {
      for (let k = i + 1; k < pad.length - 1; k++) {
        const winst = d(pad[i - 1], pad[i]) + d(pad[k], pad[k + 1]) - d(pad[i - 1], pad[k]) - d(pad[i], pad[k + 1]);
        if (winst > 0.001) {
          pad.splice(i, k - i + 1, ...pad.slice(i, k + 1).reverse());
          verbeterd = true;
        }
      }
    }
  }
  routePunten = eindVast ? pad : pad.slice(0, -1);
  routeGewijzigd();
};

function kanOptimaliseren() {
  if (routeImport) return false;
  const tussenpunten = routePunten.length - (routeRondrit ? 1 : 2);
  return tussenpunten >= 2;
}

// =====================================================
//  6. EIGEN GPX INLADEN EN KOFFIEBARS TOEVOEGEN MET EEN OMWEG
// =====================================================
document.getElementById("gpxImport").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";                         // zelfde bestand later opnieuw kunnen kiezen
  if (!bestand) return;
  if ((routePunten.length || routeImport) && !confirm(t("routeVervangen"))) return;

  try {
    const { naam, spoor } = leesGpx(await bestand.text(), bestand.name);
    zetImport({ naam, spoor, omwegen: [] });
  } catch (fout) {
    console.error(fout);
    alert(t("gpxFout"));
  }
};

// GPX-tekst → naam en een lijst punten [lat, lng, hoogte]
function leesGpx(tekst, bestandsnaam) {
  const xml = new DOMParser().parseFromString(tekst, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("Geen geldige GPX");

  let punten = [...xml.getElementsByTagName("trkpt")];
  if (punten.length === 0) punten = [...xml.getElementsByTagName("rtept")];
  const spoor = punten.map(pt => {
    const hoogte = pt.getElementsByTagName("ele")[0];
    return [Number(pt.getAttribute("lat")), Number(pt.getAttribute("lon")),
            hoogte ? Number(hoogte.textContent) : undefined];
  }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  if (spoor.length < 2) throw new Error("Geen route gevonden in de GPX");

  // De naam: uit de GPX, of anders de bestandsnaam
  const houder = xml.getElementsByTagName("trk")[0] || xml.getElementsByTagName("rte")[0] || xml.getElementsByTagName("metadata")[0];
  const naamTag = houder ? [...houder.children].find(c => c.localName === "name") : null;
  const naam = (naamTag && naamTag.textContent.trim()) || bestandsnaam.replace(/\.gpx$/i, "");

  return { naam: naam.slice(0, 80), spoor: vereenvoudig(spoor) };
}

// Minder punten bewaren: telkens minstens 10 m uit elkaar (en hooguit ± 5000 punten)
function vereenvoudig(spoor) {
  const lengte = spoor.reduce((som, p, i) => i ? som + afstandKm(spoor[i - 1], p) : 0, 0);
  const minimum = Math.max(0.01, lengte / 5000);   // km
  const uit = [spoor[0]];
  for (let i = 1; i < spoor.length - 1; i++) {
    if (afstandKm(uit[uit.length - 1], spoor[i]) >= minimum) uit.push(spoor[i]);
  }
  uit.push(spoor[spoor.length - 1]);
  return uit;
}

function zetImport(importRoute, bron = null) {
  if (!routeModus) document.getElementById("routeKnop").click();   // Route plannen openen
  routePunten = [];
  routeRondrit = false;
  routeImport = { naam: importRoute.naam, spoor: importRoute.spoor, omwegen: importRoute.omwegen || [] };
  routeGewijzigd({ bron });
  kaart.fitBounds(L.latLngBounds(routeImport.spoor.map(([lat, lng]) => [lat, lng])), { padding: [30, 30] });
}

// Een omweg naar een bar toevoegen of weer weghalen
async function wisselOmweg(stop) {
  if (barInRoute(stop)) {
    routeImport.omwegen = routeImport.omwegen.filter(o => o.stopId !== stop.id);
    routeGewijzigd();
    return;
  }
  const deze = routeImport;
  const index = dichtstePuntIndex(deze.spoor, [stop.lat, stop.lng]);
  const [lat, lng] = deze.spoor[index];
  const melding = document.getElementById("routeMelding");
  melding.textContent = t("omwegBerekenen");

  // Van het dichtste punt van je route naar de bar, en terug
  const heen = { lat, lng }, bar = { lat: stop.lat, lng: stop.lng };
  let { lijn, reserve } = await vraagLijn([heen, bar, heen]);
  if (routeImport !== deze) return;               // intussen iets anders ingeladen of gewist
  if (!lijn) {                                    // geen routeplanner bereikbaar: een rechte lijn
    lijn = { punten: [[lat, lng], [stop.lat, stop.lng], [lat, lng]], km: 2 * afstandKm([lat, lng], [stop.lat, stop.lng]) };
  }
  melding.textContent = reserve ? t("routeReserve") : "";

  routeImport.omwegen.push({
    stopId: stop.id, naam: stop.naam, lat: stop.lat, lng: stop.lng,
    index: index, lijn: lijn.punten, km: Number(lijn.km.toFixed(2))
  });
  routeGewijzigd();
}

// Welk punt van een lijst ligt het dichtst bij een plek?
function dichtstePuntIndex(punten, plek) {
  let beste = 0, kleinste = Infinity;
  punten.forEach((p, i) => {
    const d = afstandKm(p, plek);
    if (d < kleinste) { kleinste = d; beste = i; }
  });
  return beste;
}

// Het ingeladen spoor met de omwegen erin geschoven
function samengevoegdeLijn() {
  const punten = [];
  routeImport.spoor.forEach((p, i) => {
    punten.push(p);
    for (const o of routeImport.omwegen) {
      if (o.index === i) punten.push(...o.lijn.slice(1));
    }
  });
  const km = punten.reduce((som, p, i) => i ? som + afstandKm(punten[i - 1], p) : 0, 0);
  return { punten, km, hoogtemeters: stijging(punten) };
}

// Hoeveel hoogtemeters klim je? (kleine schommelingen onder 5 m tellen niet mee)
function stijging(punten) {
  const hoogtes = punten.map(p => p[2]).filter(h => h !== undefined && h !== null && Number.isFinite(Number(h))).map(Number);
  if (hoogtes.length < 2) return null;
  let basis = hoogtes[0], som = 0;
  for (const h of hoogtes) {
    if (h - basis >= 5) { som += h - basis; basis = h; }
    else if (h < basis) basis = h;
  }
  return Math.round(som);
}

// =====================================================
//  7. DE ROUTE OP DE KAART
// =====================================================
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

  if (routeImport) {
    // Start van de GPX, en de bars met een omweg
    const [lat, lng] = routeImport.spoor[0];
    L.marker([lat, lng], { icon: L.divIcon({ className: "routePunt", html: "▶", iconSize: [24, 24] }) })
      .bindTooltip(t("routeStart")).addTo(routeLaag);
    routeImport.omwegen.forEach((o, i) => {
      const speld = L.marker([o.lat, o.lng], {
        icon: L.divIcon({ className: "routePunt bar", html: String(i + 1), iconSize: [24, 24] })
      }).bindTooltip(o.naam).addTo(routeLaag);
      speld.on("click", () => {
        routeImport.omwegen = routeImport.omwegen.filter(x => x.stopId !== o.stopId);
        routeGewijzigd();
      });
    });
    return;
  }

  // Zelf gepland: genummerde punten; losse punten kun je verslepen
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

// =====================================================
//  8. HET PANEEL NAAST DE KAART
// =====================================================
function tekenRoutePaneel() {
  const paneel = document.getElementById("routePaneel");
  if (!routeModus) return;
  const lijst = paneel.querySelector("#routeStops");

  if (routeImport) {
    // Ingeladen GPX: de naam, en de bars met hun omweg
    lijst.innerHTML = `
      <li class="import"><span class="nr">GPX</span><span class="naam">${esc(routeImport.naam)}</span></li>` +
      routeImport.omwegen.map((o, i) => `
      <li class="bar">
        <span class="nr">${String(i + 1).padStart(2, "0")}</span>
        <span class="naam">${esc(o.naam)}</span>
        <small class="omwegKm">+${String(o.km.toFixed(1)).replace(".", ",")} km</small>
        <span class="knopjes"><button data-omwegweg="${o.stopId}" aria-label="Verwijderen">✕</button></span>
      </li>`).join("");
    lijst.querySelectorAll("[data-omwegweg]").forEach(k => k.onclick = () => {
      routeImport.omwegen = routeImport.omwegen.filter(o => o.stopId !== k.dataset.omwegweg);
      routeGewijzigd();
    });
  } else {
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
    lijst.querySelectorAll("[data-op]").forEach(k => k.onclick = () => verschuif(Number(k.dataset.op), -1));
    lijst.querySelectorAll("[data-neer]").forEach(k => k.onclick = () => verschuif(Number(k.dataset.neer), 1));
    lijst.querySelectorAll("[data-weg]").forEach(k => k.onclick = () => {
      routePunten.splice(Number(k.dataset.weg), 1);
      routeGewijzigd();
    });
  }
  paneel.querySelector("#routeLeeg").hidden = routePunten.length > 0 || Boolean(routeImport);

  // Afstand, hoogtemeters en rijtijd
  const samenvatting = paneel.querySelector("#routeSamenvatting");
  if (routeLijn) {
    const minuten = Math.round(routeLijn.km / routeSnelheid * 60);
    const tijd = minuten < 60 ? minuten + " min"
      : Math.floor(minuten / 60) + "u" + String(minuten % 60).padStart(2, "0");
    samenvatting.innerHTML = `<b>${routeLijn.km.toFixed(1).replace(".", ",")} km</b>
      ${routeLijn.hoogtemeters !== null && routeLijn.hoogtemeters !== undefined ? `<b class="hm">↗ ${routeLijn.hoogtemeters} hm</b>` : ""}
      <span>± ${tijd} ${t("aan")} ${routeSnelheid} km/u</span>`;
  } else {
    samenvatting.innerHTML = "";
  }

  // Welke knoppen kun je nu gebruiken?
  paneel.querySelector("#rondritLabel").hidden = Boolean(routeImport);
  paneel.querySelector("#routeRondrit").checked = routeRondrit;
  paneel.querySelector("#routeHier").hidden = Boolean(routeImport);
  paneel.querySelector("#routeOptimaliseer").hidden = Boolean(routeImport);
  paneel.querySelector("#routeOptimaliseer").disabled = !kanOptimaliseren();
  paneel.querySelector("#routeTerug").disabled = geschiedenis.length === 0;
  paneel.querySelector("#routeGpx").disabled = !routeLijn;
  paneel.querySelector("#routeGoogle").disabled = Boolean(routeImport) || routePunten.length < 2;
  const delen = paneel.querySelector("#routeDelen");
  delen.disabled = !kanDelen();
  delen.title = routeImport && !kanDelen() ? t("importDelenUitleg") : "";
  paneel.querySelector("#routeBewaar").disabled = !routeLijn;

  tekenBarsLangsRoute();
}

function verschuif(i, richting) {
  const j = i + richting;
  if (j < 0 || j >= routePunten.length) return;
  [routePunten[i], routePunten[j]] = [routePunten[j], routePunten[i]];
  routeGewijzigd();
}

// =====================================================
//  9. KOFFIEBARS LANGS JE ROUTE (max. 2 km omweg)
// =====================================================
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

  // Omweg = heen en terug, dus bars tot de helft van de maximale omweg van de route
  const tips = alleStops
    .filter(stop => !barInRoute(stop))
    .map(stop => ({ stop, km: afstandTotRoute(stop) }))
    .filter(x => 2 * x.km <= MAX_OMWEG_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, 10);

  blok.innerHTML = `<strong>☕ ${t("barsLangsRoute")}</strong>` + (tips.length === 0
    ? `<p class="leeg">${t("geenBarsLangsRoute")}</p>`
    : `<ul>${tips.map(({ stop, km }) => `
        <li>
          <span><b>${esc(stop.naam)}</b>
          <small>${km < 0.1 ? t("opDeRoute") : "± +" + (2 * km).toFixed(1).replace(".", ",") + " km " + t("omweg")}</small></span>
          <button data-tip="${stop.id}">➕</button>
        </li>`).join("")}</ul>`);

  blok.querySelectorAll("[data-tip]").forEach(knop => {
    knop.onclick = () => wisselBarInRoute(alleStops.find(s => s.id === knop.dataset.tip));
  });
}

// =====================================================
//  10. KNOPPEN IN HET PANEEL
// =====================================================
document.getElementById("routeRondrit").onchange = (event) => {
  routeRondrit = event.target.checked;
  routeGewijzigd();
};

document.getElementById("routeWissen").onclick = () => {
  routePunten = [];
  routeImport = null;
  routeLijn = null;
  routeGewijzigd();
  document.getElementById("routeMelding").textContent = "";
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

// De bars in de route (voor de GPX)
function barsInRoute() {
  if (routeImport) return routeImport.omwegen.map(o => ({ lat: o.lat, lng: o.lng, naam: o.naam }));
  return routePunten.filter(p => p.stopId);
}

// GPX downloaden: voor Garmin, Wahoo, Strava, Komoot, …
document.getElementById("routeGpx").onclick = () => {
  if (!routeLijn) return;
  const xml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const titel = routeImport ? routeImport.naam + " + ☕" : "Roast Route – " + routeLijn.km.toFixed(0) + " km";
  const bars = barsInRoute()
    .map(p => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><name>☕ ${xml(p.naam)}</name></wpt>`).join("\n");
  const spoor = routeLijn.punten
    .map(([lat, lng, hoogte]) => `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">` +
         (hoogte !== undefined && hoogte !== null ? `<ele>${Number(hoogte).toFixed(1)}</ele>` : "") + `</trkpt>`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Roast Route" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(titel)}</name></metadata>
${bars}
  <trk>
    <name>${xml(titel)}</name>
    <trkseg>
${spoor}
    </trkseg>
  </trk>
</gpx>`;
  const bestandsnaam = (routeImport ? routeImport.naam : "roast-route-" + routeLijn.km.toFixed(0) + "km")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "roast-route";
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([gpx], { type: "application/gpx+xml" }));
  link.download = bestandsnaam + (routeImport ? "-koffie" : "") + ".gpx";
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
//  11. DELEN
// =====================================================
// Zelf gepland: de hele route zit in de link (…/#route=…).
// Gepubliceerde route: de link verwijst naar de route in de database (…/#routeid=…).
// Een eigen GPX (niet gepubliceerd) is te groot voor een link: die kun je bewaren of downloaden.

function kanDelen() {
  if (routeBron && routeBron.publiek) return true;
  return !routeImport && routePunten.length >= 2;
}

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

document.getElementById("routeDelen").onclick = async () => {
  if (!kanDelen()) return;
  const basis = location.origin + location.pathname;
  const link = routeBron && routeBron.publiek
    ? basis + "#routeid=" + routeBron.id
    : basis + "#route=" + routeNaarCode();
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

// Een zelf geplande route op het scherm zetten (uit een link of uit een bewaarde route)
function zetRoute({ punten, rondrit, stijl }, bron = null) {
  routeImport = null;
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
  routeGewijzigd({ bron });
  if (routePunten.length) {
    kaart.fitBounds(L.latLngBounds(routePunten.map(p => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 14 });
  }
}

// ---------- Een gedeelde link openen ----------
// Staat er "#route=…" of "#routeid=…" in het adres? Onthoud het, want misschien moet je eerst nog inloggen.
if (location.hash.startsWith("#route=") || location.hash.startsWith("#routeid=")) {
  try { localStorage.setItem("gedeeldeRoute", location.hash.slice(1)); } catch {}
  history.replaceState(null, "", location.pathname + location.search);   // het adres weer proper maken
}

// Wordt opgeroepen door app.js zodra de bars geladen zijn en de kaart zichtbaar is
async function openGedeeldeRoute() {
  let waarde = null;
  try { waarde = localStorage.getItem("gedeeldeRoute"); } catch {}
  if (!waarde || alleStops.length === 0 || document.getElementById("app").hidden) return;
  try { localStorage.removeItem("gedeeldeRoute"); } catch {}

  // Oude links bevatten alleen de code (zonder "route=")
  if (!waarde.includes("=")) waarde = "route=" + waarde;
  const [soort, inhoud] = [waarde.slice(0, waarde.indexOf("=")), waarde.slice(waarde.indexOf("=") + 1)];

  try {
    if (soort === "routeid") {
      const rij = await haalRouteOp(inhoud);
      if (rij) setTimeout(() => openBewaardeRoute(rij), 50);
    } else {
      const route = codeNaarRoute(inhoud);
      setTimeout(() => zetRoute(route), 50);   // even wachten tot de kaart zijn plaats en grootte kent
    }
  } catch (fout) {
    console.error("Deze routelink klopt niet", fout);
  }
}

// =====================================================
//  12. BEWAREN, MIJN ROUTES EN ROUTES VAN ROAST ROUTE
// =====================================================
let mijnRoutes = [];
let publiekeRoutes = [];

document.getElementById("routeBewaar").onclick = async () => {
  if (!gebruiker) { alert(t("eerstInloggen")); return; }
  if (!routeLijn) return;
  const voorstel = routeImport ? routeImport.naam : t("routeStandaardNaam") + " " + routeLijn.km.toFixed(0) + " km";
  const naam = prompt(t("routeNaamVraag"), voorstel);
  if (naam === null) return;                     // geannuleerd

  const rij = {
    naam: (naam.trim() || voorstel).slice(0, 80),
    soort: routeImport ? "import" : "gepland",
    punten: routeImport
      ? { naam: routeImport.naam, spoor: routeImport.spoor, omwegen: routeImport.omwegen }
      : routePunten.map(p => ({ lat: p.lat, lng: p.lng, naam: p.naam, stopId: p.stopId })),
    rondrit: routeRondrit,
    stijl: routeStijl,
    km: Number(routeLijn.km.toFixed(1)),
    hoogtemeters: routeLijn.hoogtemeters
  };
  try {
    const bewaard = await bewaarRouteInDatabase(rij);
    if (bewaard) routeBron = { id: bewaard.id, publiek: false };
    document.getElementById("routeMelding").textContent = t("routeBewaard");
    await laadMijnRoutes();
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
  }
};

// Een bewaarde of gepubliceerde route openen
function openBewaardeRoute(r) {
  const bron = { id: r.id, publiek: Boolean(r.publiek) };
  if (r.soort === "import") {
    zetImport({ naam: r.punten.naam || r.naam, spoor: r.punten.spoor, omwegen: r.punten.omwegen || [] }, bron);
  } else {
    zetRoute({ punten: r.punten, rondrit: r.rondrit, stijl: r.stijl }, bron);
  }
}

// Wordt opgeroepen door app.js na het inloggen en uitloggen
async function laadMijnRoutes() {
  mijnRoutes = [];
  publiekeRoutes = [];
  try { publiekeRoutes = await haalPubliekeRoutesOp(); }
  catch (fout) { console.error(fout); }
  if (gebruiker) {
    try { mijnRoutes = await haalRoutesOp(); }
    catch (fout) { console.error(fout); }
  }
  tekenRouteLijsten();
}

function routeRegel(r, eigen) {
  const info = `${String(r.km ?? "?").replace(".", ",")} km` +
               (r.hoogtemeters ? " · ↗ " + r.hoogtemeters + " hm" : "") +
               (r.soort === "import" ? " · GPX" : "");
  return `
    <li>
      <span><b>${r.publiek && eigen ? "🌍 " : ""}${esc(r.naam)}</b><small>${info}</small></span>
      <span class="knopjes">
        <button data-open="${r.id}">${t("routeOpenen")}</button>
        ${eigen && isBeheerder()
          ? `<button data-publiek="${r.id}" class="${r.publiek ? "actief" : ""}" title="${t("publicerenUitleg")}">🌍</button>` : ""}
        ${eigen ? `<button data-wisroute="${r.id}" aria-label="Verwijderen">✕</button>` : ""}
      </span>
    </li>`;
}

function tekenRouteLijsten() {
  document.getElementById("routeBewaar").hidden = !gebruiker;

  // Routes van Roast Route (door de beheerder gepubliceerd), voor iedereen
  const publiekBlok = document.getElementById("publiekeRoutes");
  publiekBlok.innerHTML = publiekeRoutes.length
    ? `<strong>⭐ ${t("publiekeRoutes")}</strong><ul>${publiekeRoutes.map(r => routeRegel(r, false)).join("")}</ul>`
    : "";

  // Mijn routes
  const mijnBlok = document.getElementById("mijnRoutes");
  mijnBlok.innerHTML = gebruiker && mijnRoutes.length
    ? `<strong>💾 ${t("mijnRoutes")}</strong><ul>${mijnRoutes.map(r => routeRegel(r, true)).join("")}</ul>`
    : "";

  for (const blok of [publiekBlok, mijnBlok]) {
    blok.querySelectorAll("[data-open]").forEach(knop => {
      knop.onclick = () => {
        const r = [...mijnRoutes, ...publiekeRoutes].find(x => x.id === knop.dataset.open);
        if (r) openBewaardeRoute(r);
      };
    });
  }

  mijnBlok.querySelectorAll("[data-wisroute]").forEach(knop => {
    knop.onclick = async () => {
      if (!confirm(t("zekerRouteWissen"))) return;
      try {
        await verwijderRouteUitDatabase(knop.dataset.wisroute);
        await laadMijnRoutes();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
  });

  // Alleen de beheerder: een route publiceren of weer privé maken
  mijnBlok.querySelectorAll("[data-publiek]").forEach(knop => {
    knop.onclick = async () => {
      const r = mijnRoutes.find(x => x.id === knop.dataset.publiek);
      const nieuw = !r.publiek;                    // publiek ↔ privé
      try {
        await zetRoutePubliek(r.id, nieuw);
        if (routeBron && routeBron.id === r.id) routeBron = { id: r.id, publiek: nieuw };
        await laadMijnRoutes();
        tekenRoutePaneel();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
  });
}

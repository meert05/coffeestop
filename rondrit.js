// =====================================================
//  WAYPOUR – 🎲 Rondrit maken
// =====================================================
// Je kiest een start, een afstand, een richting, het terrein en 1 of 2 koffiestops.
// De app zoekt dan zelf drie rondritten langs koffiebars die open zijn als je er aankomt.
//
// Hoe? Een rondrit is ruwweg een cirkel (of een ovaal) door je startpunt.
//  * 1 koffiestop: de bar ligt op het verste punt; links en rechts komt een tussenpunt.
//  * 2 koffiestops: de bars liggen op ± 1/3 en 2/3 van de lus, met een tussenpunt ertussen.
// Wegen kronkelen: een lus van 80 km is in vogelvlucht maar ± 64 km. We rekenen met die
// "kronkelfactor", vragen de echte route aan de routeplanner, en schuiven de tussenpunten
// tot de afstand klopt (hooguit 3 pogingen).

const RONDRIT_NIEUW_TOT = Date.parse("2026-11-08T00:00:00");   // tot dan: "✨ Nieuw" op de knop
const RICHTINGEN = { verras: null, noord: 0, oost: 90, zuid: 180, west: 270 };

let rondritKeuze = { start: "mij", km: 60, richting: "verras", terrein: "maaktNiet", stops: 1 };
let rondritVoorstellen = [];
let rondritBezig = 0;           // om een oude zoektocht te negeren

// ---------- Rekenen op de kaart (genoeg nauwkeurig voor een fietsrit) ----------
function verplaats(p, koers, km) {
  const rad = koers * Math.PI / 180;
  return {
    lat: p.lat + (km * Math.cos(rad)) / 110.57,
    lng: p.lng + (km * Math.sin(rad)) / (111.32 * Math.cos(p.lat * Math.PI / 180))
  };
}
function koersNaar(a, b) {
  const dy = (b.lat - a.lat) * 110.57;
  const dx = (b.lng - a.lng) * 111.32 * Math.cos(a.lat * Math.PI / 180);
  return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
}
function hoekVerschil(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
const km = (a, b) => afstandKm([a.lat, a.lng], [b.lat, b.lng]);

// Is de bar open als je er (ongeveer) aankomt? true, false, of null (uren onbekend)
function openBijAankomst(stop, aankomst) {
  if (typeof openStatus !== "function") return null;
  const status = openStatus(stop, aankomst);
  return status === null ? null : status.open;
}
function aankomstNa(vertrek, kmTot) {
  return new Date(vertrek.getTime() + (kmTot / (routeSnelheid || 25)) * 3600 * 1000);
}

function kandidaatBars() {
  return alleStops.filter(s => s.zichtbaar !== false && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

// ---------- 1 koffiestop: kies een bar op ± de juiste afstand in de juiste richting ----------
function kiesBarVoor(start, koers, doelKm, vertrek, alGebruikt, k) {
  const L = doelKm / k;                         // de lus in vogelvlucht
  const ideaal = 0.354 * L;                     // dan wordt de lus mooi rond
  // Eerst zoeken in de gekozen richting; niets gevonden? Dan wat ruimer
  for (const maxHoek of [55, 100]) {
    const beste = kiesBarBinnen(start, koers, doelKm, vertrek, alGebruikt, L, ideaal, maxHoek);
    if (beste) return beste;
  }
  return null;
}
function kiesBarBinnen(start, koers, doelKm, vertrek, alGebruikt, L, ideaal, maxHoek) {
  let beste = null;
  for (const s of kandidaatBars()) {
    if (alGebruikt.has(s.id)) continue;
    const d = km(start, s);
    if (d < 0.2 * L || d > 0.47 * L) continue;
    const verschil = hoekVerschil(koersNaar(start, s), koers);
    if (verschil > maxHoek) continue;
    const open = openBijAankomst(s, aankomstNa(vertrek, doelKm / 2));
    if (open === false) continue;
    const score = Math.abs(d - ideaal) / ideaal + verschil / 70 + (open === null ? 0.6 : 0);
    if (!beste || score < beste.score) beste = { stop: s, score, open };
  }
  return beste;
}

// De punten voor een ovaal: start → zijpunt → bar → zijpunt → (start)
function ovaalPunten(start, bar, b, kant) {
  const a = km(start, bar) / 2;
  const koers = koersNaar(start, bar);
  const midden = verplaats(start, koers, a);
  const z1 = verplaats(midden, koers + 90 * kant, b);
  const z2 = verplaats(midden, koers - 90 * kant, b);
  return [z1, z2];
}
function breedteVoor(a, doelKm, k) {
  const helft = doelKm / (4 * k);               // de lus bestaat uit 4 stukken van √(a² + b²)
  return helft > a ? Math.max(0.15 * a, Math.sqrt(helft * helft - a * a)) : 0.15 * a;
}

async function maakEenStop(start, koers, doelKm, vertrek, alGebruikt, kant) {
  let k = 1.25;
  const keuze = kiesBarVoor(start, koers, doelKm, vertrek, alGebruikt, k);
  if (!keuze) return null;
  const bar = keuze.stop;
  const a = km(start, bar) / 2;
  let b = breedteVoor(a, doelKm, k);
  let beste = null;
  for (let poging = 0; poging < 3; poging++) {
    const [z1, z2] = ovaalPunten(start, bar, b, kant);
    const punten = [start, z1, barPunt(bar), z2];
    const lijn = await rondritLijn(punten);
    if (!lijn) { b *= 0.7; continue; }          // bv. een tussenpunt in zee: wat dichter bij
    if (!beste || Math.abs(lijn.km - doelKm) < Math.abs(beste.lijn.km - doelKm)) beste = { punten, lijn };
    if (Math.abs(lijn.km - doelKm) / doelKm <= 0.07) break;
    k = lijn.km / (4 * Math.sqrt(a * a + b * b));   // de echte kronkelfactor van deze streek
    const nieuw = breedteVoor(a, doelKm, k);
    if (Math.abs(nieuw - b) < 0.2) break;            // bijsturen helpt niet meer
    b = nieuw;
  }
  if (!beste) return null;
  return { ...beste, sleutel: bar.id + (kant > 0 ? "+" : "-"), bars: [{ stop: bar, kmTot: beste.lijn.km / 2, open: keuze.open }] };
}

// ---------- 2 koffiestops: twee bars die samen met de start een mooie driehoek maken ----------
function kiesTweeBars(start, koers, doelKm, vertrek, alGebruikt) {
  const k = 1.25;
  const L = doelKm / k;
  const lijst = kandidaatBars().map(s => ({ s, d: km(start, s), koers: koersNaar(start, s) }))
    .filter(x => x.d >= 0.12 * L && x.d <= 0.45 * L);
  let beste = null;
  for (let i = 0; i < lijst.length; i++) {
    for (let j = 0; j < lijst.length; j++) {
      if (i === j) continue;
      const x = lijst[i], y = lijst[j];
      const tussen = hoekVerschil(x.koers, y.koers);
      if (tussen < 35 || tussen > 150) continue;
      // Rijrichting: eerst x, dan y (met de klok mee of tegen de klok in, allebei goed)
      const lus = x.d + km(x.s, y.s) + y.d;
      const fout = Math.abs(lus - L) / L;
      if (fout > 0.3) continue;
      const midKoers = (x.koers + hoekVerschil(x.koers, y.koers) / 2 * (((y.koers - x.koers + 360) % 360) < 180 ? 1 : -1) + 360) % 360;
      const richting = koers === null ? 0 : hoekVerschil(midKoers, koers) / 90;
      const sleutel = [x.s.id, y.s.id].sort().join("|");
      if (alGebruikt.has(sleutel)) continue;
      const deel1 = x.d / lus, deel2 = (x.d + km(x.s, y.s)) / lus;
      const open1 = openBijAankomst(x.s, aankomstNa(vertrek, doelKm * deel1));
      const open2 = openBijAankomst(y.s, aankomstNa(vertrek, doelKm * deel2));
      if (open1 === false || open2 === false) continue;
      // Liefst: juiste lengte, juiste richting, de bars niet vlak na elkaar, uren gekend
      const ongelijk = Math.abs(deel1 - 1 / 3) + Math.abs(deel2 - 2 / 3);
      const score = fout * 2 + richting + ongelijk + (open1 === null ? 0.3 : 0) + (open2 === null ? 0.3 : 0);
      if (!beste || score < beste.score) beste = { score, een: x.s, twee: y.s, open1, open2, sleutel };
    }
  }
  return beste;
}

async function maakTweeStops(start, koers, doelKm, vertrek, alGebruikt) {
  const keuze = kiesTweeBars(start, koers, doelKm, vertrek, alGebruikt);
  if (!keuze) return null;
  const B1 = barPunt(keuze.een), B2 = barPunt(keuze.twee);
  // Een tussenpunt tussen de twee bars, naar buiten geschoven als de lus te kort is
  const midden = { lat: (B1.lat + B2.lat) / 2, lng: (B1.lng + B2.lng) / 2 };
  const naarBuiten = koersNaar(start, midden);
  let extra = 0;
  let beste = null;
  for (let poging = 0; poging < 3; poging++) {
    const ver = verplaats(midden, naarBuiten, extra);
    const punten = [start, B1, ver, B2];
    const lijn = await rondritLijn(punten);
    if (!lijn) { if (extra === 0) return null; extra *= 0.5; continue; }
    if (!beste || Math.abs(lijn.km - doelKm) < Math.abs(beste.lijn.km - doelKm)) beste = { punten, lijn };
    if (lijn.km >= doelKm * 0.92) break;              // te lang kunnen we niet korter maken
    extra += (doelKm - lijn.km) / (2 * 1.3);
  }
  if (!beste) return null;
  const s1 = km(start, B1), s2 = km(B1, B2) + km(B2, start);
  const deel = s1 / (s1 + s2);
  return {
    ...beste, sleutel: keuze.sleutel,
    bars: [
      { stop: keuze.een, kmTot: beste.lijn.km * deel, open: keuze.open1 },
      { stop: keuze.twee, kmTot: beste.lijn.km * (deel + km(B1, B2) / (s1 + s2)), open: keuze.open2 }
    ]
  };
}

function barPunt(stop) {
  return { lat: stop.lat, lng: stop.lng, naam: stop.naam, stopId: stop.id };
}

// De routeplanner vragen voor een lus (terug naar de start)
async function rondritLijn(punten) {
  const { lijn } = await vraagLijn([...punten, punten[0]]);
  return lijn && lijn.km > 1 ? lijn : null;
}

// ---------- Drie voorstellen zoeken ----------
async function zoekRondritten(start, keuze, vertrek, voortgang) {
  const vast = RICHTINGEN[keuze.richting];
  const basis = vast === null ? Math.random() * 360 : vast;
  const koersen = vast === null ? [basis, basis + 120, basis + 240] : [vast, vast - 35, vast + 35];
  const voorstellen = [];
  const gebruikt = new Set();       // bars (1 stop) of paren van bars (2 stops) die we al voorstelden
  const sleutels = new Set();
  for (let i = 0; i < koersen.length; i++) {
    voortgang(i + 1, koersen.length);
    const koers = (koersen[i] + 360) % 360;
    let v = null;
    try {
      if (keuze.stops === 2) {
        v = await maakTweeStops(start, vast === null && i === 0 ? null : koers, keuze.km, vertrek, gebruikt);
      } else {
        const kant = i % 2 ? -1 : 1;
        v = await maakEenStop(start, koers, keuze.km, vertrek, gebruikt, kant);
        // Weinig bars in de buurt? Dan dezelfde bar, maar langs de andere kant (andere wegen)
        if (!v && voorstellen.length) v = await maakEenStop(start, koers, keuze.km, vertrek, new Set(), -kant);
      }
    } catch (fout) { console.error(fout); }
    if (!v || sleutels.has(v.sleutel)) continue;
    sleutels.add(v.sleutel);
    if (keuze.stops === 2) gebruikt.add(v.sleutel); else v.bars.forEach(b => gebruikt.add(b.stop.id));
    voorstellen.push(v);
  }
  // Vlak: de minste hoogtemeters eerst; heuvelig: de meeste; anders: de juiste afstand eerst
  const hm = v => Number(v.lijn.hoogtemeters) || 0;
  if (keuze.terrein === "vlak") voorstellen.sort((a, b) => hm(a) - hm(b));
  else if (keuze.terrein === "heuvelig") voorstellen.sort((a, b) => hm(b) - hm(a));
  else voorstellen.sort((a, b) => Math.abs(a.lijn.km - keuze.km) - Math.abs(b.lijn.km - keuze.km));
  return voorstellen;
}

// ---------- Het venster ----------
const rondritVenster = document.getElementById("rondritVenster");

function openRondrit() {
  if (!routeModus) document.getElementById("routeKnop").click();
  document.getElementById("rondritVertrek").value = volgendKwartier();
  tekenRondritKeuzes();
  toonRondritStap("keuze");
  if (rondritVenster.showModal) rondritVenster.showModal(); else rondritVenster.setAttribute("open", "");
}

function volgendKwartier() {
  const d = new Date(Date.now() + 15 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const twee = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}T${twee(d.getHours())}:${twee(d.getMinutes())}`;
}

function toonRondritStap(stap) {
  document.getElementById("rondritKeuze").hidden = stap !== "keuze";
  document.getElementById("rondritZoeken").hidden = stap !== "zoeken";
  document.getElementById("rondritUitkomst").hidden = stap !== "uitkomst";
}

// De keuzeknoppen (chips): start, richting, terrein, koffiestops, stijl
function tekenRondritKeuzes() {
  const chips = (id, waarden, sleutel, tekst) => {
    const vak = document.getElementById(id);
    vak.innerHTML = "";
    for (const w of waarden) {
      const knop = document.createElement("button");
      knop.type = "button";
      knop.className = "chip" + (String(rondritKeuze[sleutel]) === String(w) ? " actief" : "");
      knop.textContent = tekst(w);
      knop.onclick = () => { rondritKeuze[sleutel] = typeof rondritKeuze[sleutel] === "number" ? Number(w) : w; tekenRondritKeuzes(); };
      vak.appendChild(knop);
    }
  };
  chips("rondritStart", ["mij", "kaart"], "start", w => t("rondritStart_" + w));
  chips("rondritRichting", Object.keys(RICHTINGEN), "richting", w => t("richting_" + w));
  chips("rondritTerrein", ["vlak", "maaktNiet", "heuvelig"], "terrein", w => t("terrein_" + w));
  chips("rondritStops", [1, 2], "stops", w => w === 1 ? t("eenKoffiestop") : t("tweeKoffiestops"));
  const stijlen = document.getElementById("rondritStijl");
  stijlen.innerHTML = "";
  for (const stijl of Object.keys(ROUTE_STIJLEN)) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "chip" + (stijl === routeStijl ? " actief" : "");
    knop.textContent = t("stijl_" + stijl);
    knop.onclick = () => { routeStijl = stijl; tekenStijlKnoppen(); tekenRondritKeuzes(); };
    stijlen.appendChild(knop);
  }
  const schuif = document.getElementById("rondritKm");
  schuif.value = rondritKeuze.km;
  document.getElementById("rondritKmTekst").textContent = rondritKeuze.km + " km";
  document.getElementById("rondritStartUitleg").textContent = rondritKeuze.start === "kaart" ? t("rondritKaartUitleg") : "";
}
document.getElementById("rondritKm").oninput = (event) => {
  rondritKeuze.km = Number(event.target.value);
  document.getElementById("rondritKmTekst").textContent = rondritKeuze.km + " km";
};

function haalStart() {
  if (rondritKeuze.start === "kaart") {
    const c = kaart.getCenter();
    return Promise.resolve({ lat: c.lat, lng: c.lng });
  }
  return new Promise((klaar, mislukt) => {
    if (!navigator.geolocation) { mislukt(new Error(t("geenLocatie"))); return; }
    navigator.geolocation.getCurrentPosition(
      p => klaar({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => mislukt(new Error(t("locatieGeweigerd"))),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
}

document.getElementById("rondritFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("rondritMelding");
  melding.textContent = "";
  const vertrekWaarde = document.getElementById("rondritVertrek").value;
  const vertrek = vertrekWaarde ? new Date(vertrekWaarde) : new Date();
  let start;
  try { start = await haalStart(); }
  catch (fout) { melding.textContent = fout.message + " " + t("rondritProbeerKaart"); return; }

  const beurt = ++rondritBezig;
  toonRondritStap("zoeken");
  const tekst = document.getElementById("rondritZoekTekst");
  const balk = document.getElementById("rondritBalk");
  const voorstellen = await zoekRondritten({ ...start, naam: t("rondritStartNaam") }, rondritKeuze, vertrek, (n, totaal) => {
    tekst.textContent = t("rondrittenZoeken").replace("{n}", n).replace("{totaal}", totaal);
    balk.style.width = Math.round(((n - 0.5) / totaal) * 100) + "%";
  });
  if (beurt !== rondritBezig || !rondritVenster.open) return;   // intussen gesloten of opnieuw gezocht
  rondritVoorstellen = voorstellen.map(v => ({ ...v, vertrek, start }));
  tekenRondritVoorstellen();
  toonRondritStap("uitkomst");
};

document.getElementById("rondritOpnieuw").onclick = () => toonRondritStap("keuze");
document.getElementById("rondritSluiten").onclick = () => { rondritBezig++; rondritVenster.close(); };

// Een klein kaartje van de lus (als lijntekening)
function rondritSchets(v) {
  const pts = v.lijn.punten;
  const stap = Math.max(1, Math.floor(pts.length / 200));
  const lat0 = v.start.lat, f = Math.cos(lat0 * Math.PI / 180);
  const xy = pts.filter((_, i) => i % stap === 0).map(([lat, lng]) => [lng * f, -lat]);
  const xs = xy.map(p => p[0]), ys = xy.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maat = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
  const proj = ([x, y]) => [8 + ((x - minX) / maat) * 84 + (84 - ((Math.max(...xs) - minX) / maat) * 84) / 2,
                            8 + ((y - minY) / maat) * 84 + (84 - ((Math.max(...ys) - minY) / maat) * 84) / 2];
  const pad = xy.map((p, i) => (i ? "L" : "M") + proj(p).map(n => n.toFixed(1)).join(" ")).join("");
  const [sx, sy] = proj([v.start.lng * f, -v.start.lat]);
  const bars = v.bars.map(b => { const [x, y] = proj([b.stop.lng * f, -b.stop.lat]); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" class="bar"/>`; }).join("");
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${pad}" class="lus"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="start"/>${bars}</svg>`;
}

function rijtijd(kmLang) {
  const minuten = Math.round((kmLang / (routeSnelheid || 25)) * 60);
  return Math.floor(minuten / 60) + "u" + String(minuten % 60).padStart(2, "0");
}
function klokje(d) {
  return d.toLocaleTimeString(taal === "fr" ? "fr-BE" : taal === "en" ? "en-GB" : "nl-BE", { hour: "2-digit", minute: "2-digit" });
}

function tekenRondritVoorstellen() {
  const vak = document.getElementById("rondritLijst");
  vak.innerHTML = "";
  if (!rondritVoorstellen.length) {
    vak.innerHTML = `<p class="rondritNiets">${esc(t("geenRondrit"))}</p>`;
    return;
  }
  rondritVoorstellen.forEach((v, i) => {
    const kaartje = document.createElement("article");
    kaartje.className = "rondritKaart";
    const hm = Number(v.lijn.hoogtemeters);
    kaartje.innerHTML = `
      <div class="schets">${rondritSchets(v)}</div>
      <div class="info">
        <div class="cijfers"><b>${Math.round(v.lijn.km)} km</b>${hm ? `<span>↗ ${Math.round(hm)} hm</span>` : ""}<span>± ${rijtijd(v.lijn.km)}</span></div>
        <ul class="bars"></ul>
        <button type="button" class="kies ${i === 0 ? "knopHoofd" : ""}">${esc(t("dezeRoute"))}</button>
      </div>`;
    const lijst = kaartje.querySelector(".bars");
    for (const b of v.bars) {
      const li = document.createElement("li");
      const aankomst = aankomstNa(v.vertrek, b.kmTot);
      const status = typeof openStatus === "function" ? openStatus(b.stop, aankomst) : null;
      li.innerHTML = `<span class="naam"></span><small></small>`;
      li.querySelector(".naam").textContent = "☕ " + b.stop.naam;
      li.querySelector("small").textContent = t("aankomstRond").replace("{uur}", klokje(aankomst)) +
        (status && status.open ? " · " + t("openTot").replace("{uur}", status.tot) : status === null ? " · " + t("urenOnbekend") : "");
      lijst.appendChild(li);
    }
    kaartje.querySelector(".kies").onclick = () => kiesRondrit(v);
    vak.appendChild(kaartje);
  });
}

function kiesRondrit(v) {
  rondritVenster.close();
  zetRoute({ punten: v.punten, rondrit: true, stijl: routeStijl });
  v.bars.forEach(b => { if (typeof telBar === "function") telBar(b.stop.id, "in_route"); });   // anoniem tellen
  toonMelding(t("rondritGekozen"));
}

// ---------- De knop in het routepaneel, en het kaartje "✨ Nieuw" ----------
const rondritKnop = document.getElementById("rondritKnop");
rondritKnop.onclick = openRondrit;
rondritKnop.querySelector(".nieuwLabel").hidden = Date.now() > RONDRIT_NIEUW_TOT;

(function nieuwKaartje() {
  const tip = document.getElementById("nieuwTip");
  let gezien = false;
  try { gezien = localStorage.getItem("tipRondrit") === "1"; } catch {}
  if (gezien || Date.now() > RONDRIT_NIEUW_TOT + 30 * 864e5) return;
  const weg = () => { tip.hidden = true; try { localStorage.setItem("tipRondrit", "1"); } catch {} };
  document.getElementById("nieuwTipJa").onclick = () => { weg(); openRondrit(); };
  document.getElementById("nieuwTipNee").onclick = weg;
  document.getElementById("nieuwTipWeg").onclick = weg;
  // Even wachten tot de app geladen is, en niet tonen boven het welkomstscherm
  setTimeout(() => {
    const welkom = document.getElementById("welkom");
    if (welkom && !welkom.hidden && welkom.offsetParent !== null) return;
    tip.hidden = false;
  }, 2500);
})();

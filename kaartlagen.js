// =====================================================
//  KAARTLAGEN – fietssnelwegen en jaagpaden (langs het water)
// =====================================================
//
// Twee lagen die je aan- en uitzet met het blokje rechtsboven op de kaart:
//  🟧 Fietssnelwegen: de F-routes (F1, F32, …), in OpenStreetMap aangeduid met cycle_highway=yes.
//  🟦 Langs het water: jaagpaden en fietsbare paden vlak naast een kanaal of rivier.
// De lijnen komen uit OpenStreetMap (via Overpass). We halen alleen op wat in beeld is,
// en onthouden wat we al hebben, zodat heen en weer schuiven geen nieuwe vragen stelt.

const LAGEN = {
  fsw:   { kleur: "#D9480F", dikte: 4, vanafZoom: 9,  sleutel: "laagFietssnelwegen" },
  water: { kleur: "#1C7ED6", dikte: 3, vanafZoom: 11, sleutel: "laagWater" }
};
const LAAG_VAK = 0.1;               // graden: de kaart is verdeeld in vakjes die we één keer ophalen
const LAAG_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",   // reserve
  "https://overpass.kumi.systems/api/interpreter"       // reserve
];
const LAAG_WACHTTIJD = 20000;       // ms: langer wachten we niet op één server

kaart.createPane("infraLaag");
kaart.getPane("infraLaag").style.zIndex = 330;    // onder de route (350) en de stippen

const laagStaat = {};
for (const [naam, laag] of Object.entries(LAGEN)) {
  let aan = true;
  try { aan = localStorage.getItem(laag.sleutel) !== "uit"; } catch {}
  laagStaat[naam] = {
    aan,
    groep: L.layerGroup(),
    geladen: new Set(),              // vakjes die al opgehaald zijn
    getekend: new Set(),             // wegen (id) die al op de kaart staan
    bezig: false,
    fout: false
  };
  if (aan) laagStaat[naam].groep.addTo(kaart);
}

// ---------- Het blokje rechtsboven op de kaart ----------
const LagenKnop = L.Control.extend({
  options: { position: "topright" },
  onAdd() {
    const blok = L.DomUtil.create("div", "lagenBlok");
    L.DomEvent.disableClickPropagation(blok);
    L.DomEvent.disableScrollPropagation(blok);
    return blok;
  }
});
const lagenKnop = new LagenKnop().addTo(kaart);

function tekenLagenKnop() {
  const blok = lagenKnop.getContainer();
  const zoom = kaart.getZoom();
  const teVer = Object.entries(LAGEN).some(([naam, laag]) => laagStaat[naam].aan && zoom < laag.vanafZoom);
  blok.innerHTML = `
    ${Object.entries(LAGEN).map(([naam, laag]) => `
      <label>
        <input type="checkbox" data-laag="${naam}" ${laagStaat[naam].aan ? "checked" : ""}>
        <i style="background:${laag.kleur}"></i>
        <span>${t("laag_" + naam)}</span>
      </label>`).join("")}
    ${teVer ? `<small>${t("laagInzoomen")}</small>` : ""}
    ${Object.values(laagStaat).some(s => s.bezig) ? `<small>${t("laagLaden")}</small>` : ""}
    ${Object.values(laagStaat).some(s => s.fout && !s.bezig)
      ? `<small>${t("laagFout")} <button type="button" class="link" data-opnieuw>${t("bijvulOpnieuw")}</button></small>` : ""}`;
  const opnieuw = blok.querySelector("[data-opnieuw]");
  if (opnieuw) opnieuw.onclick = () => {
    Object.values(laagStaat).forEach(s => { s.fout = false; });
    laadLagen();
  };
  blok.querySelectorAll("[data-laag]").forEach(vakje => {
    vakje.onchange = () => {
      const naam = vakje.dataset.laag;
      laagStaat[naam].aan = vakje.checked;
      try { localStorage.setItem(LAGEN[naam].sleutel, vakje.checked ? "aan" : "uit"); } catch {}
      if (vakje.checked) laagStaat[naam].groep.addTo(kaart);
      else kaart.removeLayer(laagStaat[naam].groep);
      laadLagen();
    };
  });
}

// ---------- Ophalen wat in beeld is ----------
function vakjesInBeeld() {
  const g = kaart.getBounds();
  const vakjes = [];
  for (let la = Math.floor(g.getSouth() / LAAG_VAK); la <= Math.floor(g.getNorth() / LAAG_VAK); la++) {
    for (let lo = Math.floor(g.getWest() / LAAG_VAK); lo <= Math.floor(g.getEast() / LAAG_VAK); lo++) {
      vakjes.push([la, lo]);
    }
  }
  return vakjes;
}

function overpassVraag(naam, bbox) {
  if (naam === "fsw") {
    return `[out:json][timeout:15];
rel["cycle_highway"="yes"](${bbox})->.r;
way(r.r)(${bbox});
out geom;`;
  }
  // Langs het water: fietsbare paden tot ± 45 m van een kanaal of rivier, plus alles wat zo heet of zo getagd is
  return `[out:json][timeout:15];
way["waterway"~"^(canal|river)$"](${bbox})->.w;
(
  way(around.w:40)["highway"~"^(cycleway|service|track|path)$"]["bicycle"!="no"]["access"!~"^(private|no)$"];
  way["towpath"="yes"]["highway"](${bbox});
  way["highway"]["name"~"jaagpad|halage",i](${bbox});
);
out geom;`;
}

async function haalLaag(naam) {
  const staat = laagStaat[naam];
  const laag = LAGEN[naam];
  if (!staat.aan || staat.bezig || kaart.getZoom() < laag.vanafZoom) return true;
  const nieuw = vakjesInBeeld().filter(([la, lo]) => !staat.geladen.has(la + "," + lo));
  if (nieuw.length === 0) return true;

  // Eén rechthoek rond alle nog ontbrekende vakjes
  const zuid = Math.min(...nieuw.map(v => v[0])) * LAAG_VAK, noord = (Math.max(...nieuw.map(v => v[0])) + 1) * LAAG_VAK;
  const west = Math.min(...nieuw.map(v => v[1])) * LAAG_VAK, oost = (Math.max(...nieuw.map(v => v[1])) + 1) * LAAG_VAK;
  const bbox = [zuid, west, noord, oost].map(x => x.toFixed(3)).join(",");

  staat.bezig = true;
  tekenLagenKnop();
  let data = null;
  for (const server of LAAG_SERVERS) {
    const stop = new AbortController();
    const wekker = setTimeout(() => stop.abort(), LAAG_WACHTTIJD);
    try {
      const antwoord = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(overpassVraag(naam, bbox)),
        signal: stop.signal
      });
      if (!antwoord.ok) throw new Error("Overpass " + antwoord.status);
      const json = await antwoord.json();
      // Overpass meldt een time-out soms met een gewoon antwoord en een "remark"
      if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
      data = json;
      break;
    } catch (fout) {
      console.warn("Kaartlaag: server lukte niet", server, fout);
    } finally {
      clearTimeout(wekker);
    }
  }
  staat.bezig = false;
  staat.fout = !data;

  if (data) {
    nieuw.forEach(([la, lo]) => staat.geladen.add(la + "," + lo));
    for (const el of data.elements || []) {
      if (el.type !== "way" || !Array.isArray(el.geometry) || staat.getekend.has(el.id)) continue;
      staat.getekend.add(el.id);
      const lijn = L.polyline(el.geometry.map(p => [p.lat, p.lon]), {
        pane: "infraLaag", color: laag.kleur, weight: laag.dikte, opacity: 0.85,
        interactive: true, bubblingMouseEvents: true
      });
      const tags = el.tags || {};
      const naamTekst = [t("laag_" + naam), tags.name || ""].filter(Boolean).join(" · ");
      lijn.bindTooltip(esc(naamTekst), { sticky: true });
      lijn.addTo(staat.groep);
    }
  }
  tekenLagenKnop();
  return Boolean(data);
}

// Eén vraag tegelijk (de gratis servers houden niet van drukte), en pas als de kaart stilstaat
let lagenWachter = null;
let lagenBezig = false;
let lagenNogEens = false;
function laadLagen() {
  tekenLagenKnop();
  clearTimeout(lagenWachter);
  lagenWachter = setTimeout(async () => {
    if (lagenBezig) { lagenNogEens = true; return; }
    lagenBezig = true;
    do {
      lagenNogEens = false;
      for (const naam of ["fsw", "water"]) {
        if (!laagStaat[naam].fout) await haalLaag(naam);
      }
    } while (lagenNogEens);
    lagenBezig = false;
  }, 700);
}

kaart.on("moveend", laadLagen);
laadLagen();

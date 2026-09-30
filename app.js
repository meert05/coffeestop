// =====================================================
//  ROAST ROUTE – alle logica van de app
// =====================================================

// ---------- Hulpje: tekst veilig in HTML zetten ----------
// Zet tekens zoals < en > om, zodat tekst van gebruikers (reviews, voorstellen)
// nooit als code wordt uitgevoerd. Dat heet "escapen".
function esc(tekst) {
  return String(tekst ?? "").replace(/[&<>"']/g, teken =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[teken]);
}

// ---------- 1. De toestand van de app ----------
let alleStops = [];          // komt uit de database
let gekozenLand = "BE";      // landcode, of "alles"
let gekozenStad = "alles";   // stad of regio binnen het gekozen land
let gekozenStop = null;      // de id van de stop waarop je klikte
let nieuwePlek = null;       // waar je klikte op de kaart voor een nieuwe stop

// Favorieten: in de browser voor bezoekers, in de database als je bent ingelogd
let favorieten = JSON.parse(localStorage.getItem("favorieten") || "[]");

// ---------- Kenmerken: wat heeft een bar te bieden? ----------
// Een nieuw kenmerk toevoegen? Zet hier één regel bij, en een vertaling in vertalingen.js
const KENMERKEN = {
  laptop: { icoon: "💻", groep: "werkplek" }
};
// De aangeklikte filterknopjes. Leeg = alles tonen. Meerdere = ze moeten allemaal kloppen.
let gekozenFilters = [];
let bewerkKenmerkenVan = null;   // de bar waarvan de beheerder de kenmerken aan het aanpassen is

function kenmerkenVan(stop) {
  return Array.isArray(stop.kenmerken) ? stop.kenmerken : [];
}

function bewaarLokaal() {
  localStorage.setItem("favorieten", JSON.stringify(favorieten));
}

// ---------- 2. De kaart ----------
const kaart = L.map("kaart").setView([50.95, 4.1], 8);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(kaart);

const stippen = L.layerGroup().addTo(kaart);

// Wielercafés in de accentkleur, gewone koffiebars in grijs
function kleur(type) {
  if (type === "coffee") return "#8E8D88";
  return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#F2F1EE";
}

// ---------- 3. Welke stops tonen we? ----------
function zichtbareStops() {
  const zoekterm = document.getElementById("zoek").value.toLowerCase();

  return alleStops.filter(stop => {
    if (gekozenLand !== "alles" && landVan(stop) !== gekozenLand) return false;
    if (gekozenStad !== "alles" && groepVan(stop) !== gekozenStad) return false;
    if (gekozenFilters.includes("wieler") && stop.type === "coffee") return false;
    if (gekozenFilters.includes("laptop") && !kenmerkenVan(stop).includes("laptop")) return false;
    if (gekozenFilters.includes("nuOpen") && !isNuOpen(stop)) return false;
    if (gekozenFilters.includes("zondagVroeg") && !zondagVroegOpen(stop)) return false;
    if (gekozenFilters.includes("favoriet") && !favorieten.includes(stop.id)) return false;
    if (gekozenFilters.includes("zonderFoto") && stop.foto) return false;
    if (!stop.naam.toLowerCase().includes(zoekterm)) return false;
    return true;
  });
}

// ---------- 4. Alles tekenen ----------
function teken() {
  tekenFilters();
  if (isBeheerder()) tekenVoorstellen();   // in de juiste taal
  const stops = zichtbareStops();
  tekenKaart(stops);
  tekenLijst(stops);
}

function tekenKaart(stops) {
  stippen.clearLayers();

  for (const stop of stops) {
    const stip = L.circleMarker([stop.lat, stop.lng], {
      radius: stop.id === gekozenStop ? 11 : 7,
      color: "#0B0B0B",
      weight: 2,
      fillColor: kleur(stop.type),
      fillOpacity: 1,
      bubblingMouseEvents: false   // een klik op een bar is geen klik op de kaart
    });
    stip.bindTooltip(stop.naam);
    stip.on("click", () => {
      // Route plannen staat aan? Dan gaat de bar in (of uit) je route
      if (typeof routeKlikOpBar === "function" && routeKlikOpBar(stop)) return;
      kies(stop.id);
    });
    stip.addTo(stippen);
  }

  // Jouw locatie: een blauwe stip
  if (mijnPlek) {
    L.circleMarker(mijnPlek, { radius: 8, color: "#0B0B0B", weight: 3, fillColor: "#8FA3B8", fillOpacity: 1 })
      .bindTooltip(t("jijBentHier")).addTo(stippen);
  }

  // De speld voor een nieuwe bar: je kunt ze verslepen als ze niet helemaal juist staat
  if (nieuwePlek) {
    const speld = L.marker(nieuwePlek, { draggable: true }).addTo(stippen);
    speld.on("dragend", () => {
      const plek = speld.getLatLng();
      nieuwePlek = [plek.lat, plek.lng];
    });
  }
}

function tekenLijst(stops) {
  document.getElementById("teller").textContent = stops.length + " " + t("stops");

  const lijst = document.getElementById("lijst");
  lijst.innerHTML = "";

  // Je locatie bekend? Dan de dichtstbijzijnde bars eerst
  if (mijnPlek) {
    stops = [...stops].sort((a, b) =>
      afstandKm(mijnPlek, [a.lat, a.lng]) - afstandKm(mijnPlek, [b.lat, b.lng]));
  }

  for (const stop of stops) {
    const li = document.createElement("li");
    li.className = stop.type + (stop.id === gekozenStop ? " gekozen" : "");

    const isFavoriet = favorieten.includes(stop.id);
    const route = "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(stop.naam + " " + (stop.adres || ""));

    li.innerHTML = `
      ${stop.foto ? `<img class="foto" src="${stop.foto}" alt="">` : ""}
      <button class="ster">${isFavoriet ? "★" : "☆"}</button>
      <h3></h3>
      <small></small>
      ${mijnPlek ? `<span class="afstand">📍 ${afstandTekst(stop)}</span>` : ""}
      <p></p>
      ${openingsurenHTML(stop)}
      <div class="labels">
        ${stop.type !== "coffee" ? `<span class="label">🚴 ${t("wieler")}</span>` : ""}
        ${kenmerkenVan(stop).filter(k => KENMERKEN[k])
            .map(k => `<span class="label">${KENMERKEN[k].icoon} ${t("kenmerk_" + k)}</span>`).join("")}
      </div>
      ${bewerkKenmerkenVan === stop.id ? `<div class="kenmerkBewerken">
        <label class="vinkje"><input type="checkbox" class="soortWieler"
            ${stop.type !== "coffee" ? "checked" : ""}> 🚴 ${t("wieler")}</label>
        ${Object.keys(KENMERKEN).map(k => `<label class="vinkje"><input type="checkbox" class="kenmerk" value="${k}"
            ${kenmerkenVan(stop).includes(k) ? "checked" : ""}> ${KENMERKEN[k].icoon} ${t("kenmerk_" + k)}</label>`).join("")}
        ${urenBewerkenHTML(stop)}
      </div>` : ""}
      <div class="acties">
        ${typeof routeKnopHTML === "function" ? routeKnopHTML(stop) : ""}
        <a href="${route}" target="_blank">${t("route")}</a>
        <button class="reviewKnop">${reviewKnopTekst(stop)}</button>
        ${isBeheerder() ? `<button class="kenmerkKnop">${t("kenmerkenBewerken")}</button>` : ""}
        ${isBeheerder() ? `<button class="fotoKnop">${t("foto")}</button>` : ""}
        ${isBeheerder() ? `<button class="wis">${t("verwijder")}</button>` : ""}
      </div>
      ${reviewsBlokHTML(stop)}`;

    li.querySelector("h3").textContent = stop.naam;
    li.querySelector("small").textContent = stop.adres || "";
    li.querySelector("p").textContent = stop["info_" + taal] || stop.info || "";

    // Favoriet aan/uit
    li.querySelector(".ster").onclick = async (event) => {
      event.stopPropagation();
      if (isFavoriet) favorieten = favorieten.filter(id => id !== stop.id);
      else favorieten.push(stop.id);
      bewaarLokaal();
      teken();

      // Ingelogd? Dan ook in de database bewaren
      if (gebruiker) {
        try { await bewaarFavoriet(stop.id, !isFavoriet); }
        catch (fout) { console.error(fout); }
      }
    };

    // Verwijderen (alleen de beheerder ziet deze knop)
    const wisKnop = li.querySelector(".wis");
    if (wisKnop) {
      wisKnop.onclick = async (event) => {
        event.stopPropagation();
        if (!confirm(t("zekerVerwijderen") + " " + stop.naam)) return;
        try {
          await verwijderStopUitDatabase(stop.id);
          alleStops = alleStops.filter(s => s.id !== stop.id);
          teken();
        } catch (fout) {
          alert(t("opslaanMislukt") + " " + fout.message);
        }
      };
    }

    // Foto toevoegen of vervangen (alleen de beheerder ziet deze knop)
    const fotoKnop = li.querySelector(".fotoKnop");
    if (fotoKnop) {
      fotoKnop.onclick = (event) => {
        event.stopPropagation();
        fotoVoorStop = stop.id;                          // onthouden voor welke bar
        document.getElementById("fotoKiezer").click();   // opent het venster om een foto te kiezen
      };
    }

    // Kenmerken aanpassen (alleen de beheerder)
    const kenmerkKnop = li.querySelector(".kenmerkKnop");
    if (kenmerkKnop) {
      kenmerkKnop.onclick = (event) => {
        event.stopPropagation();
        // Nog eens klikken sluit het lijstje met vinkjes weer
        bewerkKenmerkenVan = bewerkKenmerkenVan === stop.id ? null : stop.id;
        teken();
      };
    }
    // Alleen de vinkjes (niet de invulvakjes voor de openingsuren)
    li.querySelectorAll('.kenmerkBewerken input[type="checkbox"]').forEach(vakje => {
      vakje.onclick = (event) => event.stopPropagation();
      vakje.onchange = async () => {
        try {
          if (vakje.classList.contains("soortWieler")) {
            // Wielercafé aan of uit: dat is het "type" van de bar
            const nieuwType = vakje.checked ? "both" : "coffee";
            await werkStopBij(stop.id, { type: nieuwType });
            stop.type = nieuwType;
          } else {
            // Alle aangevinkte kenmerken van deze bar verzamelen en bewaren
            const nieuw = [...li.querySelectorAll(".kenmerkBewerken input.kenmerk:checked")].map(v => v.value);
            await zetKenmerken(stop.id, nieuw);
            stop.kenmerken = nieuw;
          }
        } catch (fout) {
          alert(t("opslaanMislukt") + " " + fout.message);
        }
        teken();
      };
    });

    // Openingsuren bewaren (alleen de beheerder)
    const bewaarUrenKnop = li.querySelector(".bewaarUren");
    if (bewaarUrenKnop) {
      li.querySelector(".urenBewerken").onclick = (event) => event.stopPropagation();
      bewaarUrenKnop.onclick = async () => {
        try {
          await bewaarUrenVan(stop, li.querySelector(".urenBewerken"));
          teken();
        } catch (fout) {
          alert(t("opslaanMislukt") + " " + fout.message);
        }
      };
    }

    // De openingsuren openklappen mag de kaart niet laten verspringen
    const uren = li.querySelector(".uren");
    if (uren) uren.onclick = (event) => event.stopPropagation();

    // Reviews
    koppelReviews(li, stop);

    // "➕ In route" (alleen als Route plannen aanstaat)
    if (typeof koppelRouteKnop === "function") koppelRouteKnop(li, stop);

    li.onclick = () => kies(stop.id);
    lijst.appendChild(li);
  }
}

// ---------- 5. Een stop kiezen ----------
function kies(id) {
  gekozenStop = id;
  const stop = alleStops.find(s => s.id === id);
  kaart.setView([stop.lat, stop.lng], 15);
  teken();
}

// ---------- 6. Reageren op wat de gebruiker doet ----------

// ---------- Landen en steden: knoppen automatisch uit de data ----------

// Het land van een bar, als code: "BE", "ES", "FR", …
function landVan(stop) {
  if (stop.landcode) return stop.landcode;
  const belgie = ["België", "Belgique", "Belgium"];
  return belgie.includes(stop.land || "België") ? "BE" : stop.land;
}

// De naam van een land in de gekozen taal: "ES" wordt "Spanje", "Espagne" of "Spain"
function landNaam(code) {
  try {
    if (/^[A-Z]{2}$/.test(code)) return new Intl.DisplayNames([taal], { type: "region" }).of(code);
  } catch {}
  return code;
}

// Steden in het buitenland, in elke taal. "ook" = andere schrijfwijzen van dezelfde stad,
// zodat "Paris", "Parijs" en "Paris" (FR) samen onder één knop komen.
const STADNAMEN = {
  amsterdam:  { nl: "Amsterdam",  fr: "Amsterdam",  en: "Amsterdam" },
  kopenhagen: { nl: "Kopenhagen", fr: "Copenhague", en: "Copenhagen", ook: ["copenhagen", "kobenhavn", "copenhague", "klampenborg"] },
  berlijn:    { nl: "Berlijn",    fr: "Berlin",     en: "Berlin",     ook: ["berlin"] },
  parijs:     { nl: "Parijs",     fr: "Paris",      en: "Paris",      ook: ["paris"] },
  londen:     { nl: "Londen",     fr: "Londres",    en: "London",     ook: ["london", "londres"] },
  nice:       { nl: "Nice",       fr: "Nice",       en: "Nice",       ook: ["nizza"] },
  barcelona:  { nl: "Barcelona",  fr: "Barcelone",  en: "Barcelona",  ook: ["barcelone"] },
  girona:     { nl: "Girona",     fr: "Gérone",     en: "Girona",     ook: ["gerona", "gerone"] },
  palma:      { nl: "Palma",      fr: "Palma",      en: "Palma",      ook: ["palma-de-mallorca", "palma-de-majorque"] },
  milaan:     { nl: "Milaan",     fr: "Milan",      en: "Milan",      ook: ["milano", "milan"] },
  rome:       { nl: "Rome",       fr: "Rome",       en: "Rome",       ook: ["roma"] },
  madrid:     { nl: "Madrid",     fr: "Madrid",     en: "Madrid" },
  lissabon:   { nl: "Lissabon",   fr: "Lisbonne",   en: "Lisbon",     ook: ["lisboa", "lisbon", "lisbonne"] },
  wenen:      { nl: "Wenen",      fr: "Vienne",     en: "Vienna",     ook: ["wien", "vienna", "vienne"] },
  munchen:    { nl: "München",    fr: "Munich",     en: "Munich",     ook: ["munich", "muenchen"] },
  keulen:     { nl: "Keulen",     fr: "Cologne",    en: "Cologne",    ook: ["koln", "koeln", "cologne"] },
  "den-haag": { nl: "Den Haag",   fr: "La Haye",    en: "The Hague",  ook: ["la-haye", "the-hague", "s-gravenhage"] },
  geneve:     { nl: "Genève",     fr: "Genève",     en: "Geneva",     ook: ["geneva", "genf"] }
};

// "København Ø" → "kobenhavn-o", "Paris" → "paris"
function stadSlug(naam) {
  return String(naam || "").toLowerCase().replace(/ø/g, "o").replace(/æ/g, "ae")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Welke stad uit STADNAMEN is dit? Onbekende steden blijven zoals ze zijn.
function stadSleutel(naam) {
  const slug = stadSlug(naam);
  // Ook zonder wijkaanduiding proberen: "København Ø" → "kobenhavn", "Paris 11e" → "paris"
  for (const poging of [slug, slug.replace(/-[a-z0-9]{1,3}$/, "")]) {
    if (STADNAMEN[poging]) return poging;
    for (const [sleutel, stad] of Object.entries(STADNAMEN)) {
      if ((stad.ook || []).includes(poging)) return sleutel;
    }
  }
  return naam;
}

// De groep (stad of regio) van een bar: in België onze vaste regio's, elders de stad
function groepVan(stop) {
  if (landVan(stop) === "BE" && stop.stad !== "buitenland") return stop.stad;
  return stop.plaats ? stadSleutel(stop.plaats) : landNaam(landVan(stop));
}

// De naam op de knop, in de gekozen taal
const VASTE_REGIOS = { antwerpen: "antwerpen", gent: "gent", brussel: "brussel", hellingen: "vlaanderen" };
function groepNaam(groep) {
  if (VASTE_REGIOS[groep]) return t(VASTE_REGIOS[groep]);
  if (STADNAMEN[groep]) return STADNAMEN[groep][taal] || STADNAMEN[groep].nl;
  return groep;
}

// Een knop maken en in een rij zetten
function maakKnop(rij, tekst, actief, bijKlik) {
  const knop = document.createElement("button");
  knop.textContent = tekst;
  if (actief) knop.classList.add("actief");
  knop.onclick = bijKlik;
  rij.appendChild(knop);
}

// De rij filterknopjes. "Alles" zet alle filters uit; de andere kun je combineren.
function tekenCategorieen() {
  const rij = document.getElementById("kenmerkFilters");
  rij.innerHTML = "";
  maakKnop(rij, t("alles"), gekozenFilters.length === 0, () => {
    gekozenFilters = [];
    teken();
  });
  const filters = [
    ["wieler",      "🚴 " + t("wieler")],
    ["laptop",      "💻 " + t("kenmerk_laptop")],
    ["nuOpen",      "🟢 " + t("nuOpen")],
    ["zondagVroeg", "☀️ " + t("zondagVroeg")],
    ["favoriet",    t("favorieten")]
  ];
  // Alleen voor de beheerder: welke bars hebben nog geen foto?
  if (isBeheerder()) {
    const zonder = alleStops.filter(s => !s.foto).length;
    filters.push(["zonderFoto", "📷 " + t("zonderFoto") + " (" + zonder + ")"]);
  }
  for (const [sleutel, tekst] of filters) {
    maakKnop(rij, tekst, gekozenFilters.includes(sleutel), () => {
      // Aan- of uitzetten
      gekozenFilters = gekozenFilters.includes(sleutel)
        ? gekozenFilters.filter(f => f !== sleutel)
        : [...gekozenFilters, sleutel];
      teken();
    });
  }
}

function tekenFilters() {
  tekenCategorieen();
  // Welke landen komen voor in onze bars?
  const landen = [...new Set(alleStops.map(landVan))]
    .sort((x, y) => (x === "BE" ? -1 : y === "BE" ? 1 : landNaam(x).localeCompare(landNaam(y))));

  // Maar één land? Dan is "alle landen" hetzelfde als dat ene land (zo blijven de stadsknoppen zichtbaar)
  if (landen.length === 1) gekozenLand = landen[0];
  // Bestaat het gekozen land niet (meer)? Toon dan alle landen
  if (gekozenLand !== "alles" && landen.length > 1 && !landen.includes(gekozenLand)) gekozenLand = "alles";

  // Rij 1: landen (alleen tonen als er meer dan één land is)
  const landenRij = document.getElementById("landen");
  landenRij.innerHTML = "";
  landenRij.hidden = landen.length < 2;
  maakKnop(landenRij, t("alleLanden"), gekozenLand === "alles", () => kiesFilter("alles", "alles"));
  for (const land of landen) {
    maakKnop(landenRij, landNaam(land), gekozenLand === land, () => kiesFilter(land, "alles"));
  }

  // Rij 2: steden van het gekozen land
  const stedenRij = document.getElementById("steden");
  stedenRij.innerHTML = "";
  stedenRij.hidden = gekozenLand === "alles";
  if (gekozenLand === "alles") return;

  const volgorde = Object.keys(VASTE_REGIOS);
  const groepen = [...new Set(alleStops.filter(s => landVan(s) === gekozenLand).map(groepVan))]
    .sort((x, y) => {
      const ix = volgorde.indexOf(x), iy = volgorde.indexOf(y);
      if (ix !== -1 || iy !== -1) return (ix === -1 ? 99 : ix) - (iy === -1 ? 99 : iy);
      return groepNaam(x).localeCompare(groepNaam(y));   // alfabetisch in de gekozen taal
    });

  maakKnop(stedenRij, t("alles"), gekozenStad === "alles", () => kiesFilter(gekozenLand, "alles"));
  for (const groep of groepen) {
    maakKnop(stedenRij, groepNaam(groep), gekozenStad === groep, () => kiesFilter(gekozenLand, groep));
  }
}

function kiesFilter(land, stad) {
  gekozenLand = land;
  gekozenStad = stad;
  teken();
  zoomNaarStops();
}

document.getElementById("zoek").oninput = teken;

// Klikken op de kaart: plek kiezen (alleen voor de beheerder)
kaart.on("click", (event) => {
  if (!isBeheerder()) return;
  if (typeof routeModus !== "undefined" && routeModus) return;   // dan tekent route.js een punt
  nieuwePlek = [event.latlng.lat, event.latlng.lng];
  document.getElementById("plekTekst").textContent = t("plekGekozen");
  teken();
});

// Welke stad ligt het dichtst bij een plek? Verder dan 9 km = "hellingen"
function stadVan(lat, lng) {
  const centra = {
    antwerpen: [51.2194, 4.4025],
    gent: [51.0543, 3.7174],
    brussel: [50.8467, 4.3525]
  };
  for (const [stad, [clat, clng]] of Object.entries(centra)) {
    const km = Math.hypot((lat - clat) * 111, (lng - clng) * 70);
    if (km < 9) return stad;
  }
  return "hellingen";
}

// Nieuwe stop opslaan in de database (alleen de beheerder)
document.getElementById("formulier").onsubmit = async (event) => {
  event.preventDefault();

  if (!nieuwePlek) {
    document.getElementById("plekTekst").textContent = t("eerstKlikken");
    return;
  }

  const naam = document.getElementById("nieuwNaam").value.trim();
  const nieuweStop = {
    // id op basis van de naam: "Café Labath" wordt "cafe-labath"
    id: naam.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    naam: naam,
    adres: document.getElementById("nieuwAdres").value.trim(),
    land: document.getElementById("nieuwLand").value.trim() || "België",
    landcode: gevondenLandcode || null,
    plaats: document.getElementById("nieuwPlaats").value.trim(),
    stad: stadVan(nieuwePlek[0], nieuwePlek[1]),
    type: document.getElementById("nieuwWieler").checked ? "both" : "coffee",
    lat: Number(nieuwePlek[0].toFixed(5)),
    lng: Number(nieuwePlek[1].toFixed(5)),
    info: document.getElementById("nieuwInfo").value.trim(),
    kenmerken: [...document.querySelectorAll("#nieuwKenmerken input:checked")].map(v => v.value)
  };
  // Landcode niet gevonden via het adres? Dan leiden we ze af uit de naam van het land
  if (!nieuweStop.landcode) nieuweStop.landcode = landVan({ land: nieuweStop.land });
  // Buiten België hoort de bar niet bij onze vaste regio's, maar bij zijn gemeente
  if (nieuweStop.landcode !== "BE") nieuweStop.stad = "buitenland";

  try {
    // Foto gekozen? Eerst verkleinen en uploaden, dan de link bewaren bij de bar
    const fotoBestand = document.getElementById("nieuwFoto").files[0];
    if (fotoBestand) {
      document.getElementById("plekTekst").textContent = t("fotoBezig");
      nieuweStop.foto = await uploadFoto(await verkleinFoto(fotoBestand), nieuweStop.id);
    }

    await voegStopToeInDatabase(nieuweStop);
    alleStops.push(nieuweStop);
    gekozenLand = landVan(nieuweStop);   // toon het land van de nieuwe bar
    gekozenStad = "alles";
    event.target.reset();
    nieuwePlek = null;
    gevondenLandcode = "";
    document.getElementById("plekTekst").textContent = t("kiesPlek");
    kies(nieuweStop.id);
    voorstelAfgewerkt();   // kwam deze bar uit een voorstel? Dan is dat voorstel nu afgewerkt
  } catch (fout) {
    document.getElementById("plekTekst").textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// ---------- Adres opzoeken (geocoding) ----------
// We vragen aan OpenStreetMap: "waar ligt dit adres?" en krijgen coördinaten terug.
let gevondenLandcode = "";   // de landcode van het laatst opgezochte adres

async function zoekAdres(adres) {
  const url = "https://nominatim.openstreetmap.org/search"
            + "?format=jsonv2&addressdetails=1&limit=1&accept-language=nl"
            + "&q=" + encodeURIComponent(adres);
  const antwoord = await fetch(url);
  const resultaten = await antwoord.json();
  if (resultaten.length === 0) return null;   // niets gevonden

  const r = resultaten[0];
  const a = r.address;
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    land: a.country || "",
    landcode: (a.country_code || "").toUpperCase(),   // bv. "BE" of "ES"
    // Een adres heeft een "city", "town" of "village", afhankelijk van hoe groot de plaats is
    plaats: a.city || a.town || a.village || a.municipality || ""
  };
}

document.getElementById("zoekAdresKnop").onclick = async () => {
  const adres = document.getElementById("nieuwAdres").value.trim();
  const tekst = document.getElementById("plekTekst");
  if (!adres) {
    tekst.textContent = t("eerstAdres");
    return;
  }

  tekst.textContent = t("adresZoeken");
  try {
    const gevonden = await zoekAdres(adres);
    if (!gevonden) {
      tekst.textContent = t("adresNietGevonden");
      return;
    }
    nieuwePlek = [gevonden.lat, gevonden.lng];
    document.getElementById("nieuwLand").value = gevonden.land;
    gevondenLandcode = gevonden.landcode;
    document.getElementById("nieuwPlaats").value = gevonden.plaats;
    tekst.textContent = t("adresGevonden");
    kaart.setView(nieuwePlek, 17);   // inzoomen op de gevonden plek
    teken();
  } catch (fout) {
    console.error(fout);
    tekst.textContent = t("adresNietGevonden");
  }
};

// ---------- Foto's ----------
let fotoVoorStop = null;   // de bar waarvoor je net op "📷 Foto" klikte

// Maakt een foto kleiner (max. 1200 pixels breed of hoog), zodat de app snel blijft
async function verkleinFoto(bestand, maximum = 1200) {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, maximum / Math.max(beeld.width, beeld.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(beeld.width * schaal);
  canvas.height = Math.round(beeld.height * schaal);
  canvas.getContext("2d").drawImage(beeld, 0, 0, canvas.width, canvas.height);
  // Omzetten naar een JPEG-bestand met kwaliteit 80%
  return new Promise(klaar => canvas.toBlob(klaar, "image/jpeg", 0.8));
}

// Een foto gekozen via de knop "📷 Foto" bij een bestaande bar
document.getElementById("fotoKiezer").onchange = async (event) => {
  const bestand = event.target.files[0];
  const stop = alleStops.find(s => s.id === fotoVoorStop);
  event.target.value = "";   // leegmaken, zodat je dezelfde foto nog eens kunt kiezen
  if (!bestand || !stop) return;

  const teller = document.getElementById("teller");
  teller.textContent = t("fotoBezig");
  try {
    const url = await uploadFoto(await verkleinFoto(bestand), stop.id);
    await zetFotoVanStop(stop.id, url);
    stop.foto = url;
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
  }
  teken();
};

function zoomNaarStops() {
  const stops = zichtbareStops();
  if (stops.length === 0) return;
  kaart.fitBounds(L.latLngBounds(stops.map(s => [s.lat, s.lng])), { padding: [30, 30] });
}

// ---------- 7. Account: welkomstscherm, inloggen en nieuwsbrief ----------

// Moet je een account hebben om de app te zien? Zet op false om bezoekers toe te laten.
const ACCOUNT_VERPLICHT = true;
let rondkijken = false;   // true als iemand op "Eerst even rondkijken" klikte

// Toon het welkomstscherm of de app
function toonScherm() {
  if (wachtwoordHerstel) {           // eerst een nieuw wachtwoord kiezen
    document.getElementById("welkom").hidden = false;
    document.getElementById("app").hidden = true;
    toonTab("reset");
    return;
  }
  // Na een wachtwoordreset: terug naar het gewone inlogscherm
  if (!document.getElementById("resetFormulier").hidden) toonTab("login");

  // Nog bezig met "profiel afmaken"? Dan dat scherm laten staan
  const startScherm = document.getElementById("profielStart");
  if (!gebruiker) startScherm.hidden = true;
  if (!startScherm.hidden) return;

  const toonApp = (gebruiker !== null || rondkijken);
  document.getElementById("welkom").hidden = toonApp;
  document.getElementById("app").hidden = !toonApp;
  document.getElementById("ingelogd").hidden = gebruiker === null;

  if (toonApp) {
    // Een kaart die eerst verborgen was, moet zijn grootte opnieuw meten
    setTimeout(() => { kaart.invalidateSize(); zoomNaarStops(); }, 0);
  }
}

const bericht = document.getElementById("loginBericht");
// Komt iemand binnen via de link "wachtwoord vergeten"? Dan staat er ?wachtwoord=nieuw in het adres
let wachtwoordHerstel = new URLSearchParams(location.search).get("wachtwoord") === "nieuw";

// Tabbladen: "Account maken" of "Inloggen"
function toonTab(welke) {
  document.getElementById("nieuwFormulier").hidden = welke !== "nieuw";
  document.getElementById("loginFormulier").hidden = welke !== "login";
  document.getElementById("resetFormulier").hidden = welke !== "reset";
  document.getElementById("tabs").hidden = welke === "reset";
  document.getElementById("tabNieuw").classList.toggle("actief", welke === "nieuw");
  document.getElementById("tabLogin").classList.toggle("actief", welke === "login");
  bericht.textContent = "";
}
document.getElementById("tabNieuw").onclick = () => toonTab("nieuw");
document.getElementById("tabLogin").onclick = () => toonTab("login");

// Foutmeldingen van Supabase omzetten naar een duidelijke zin
function leesbareFout(fout) {
  const tekst = (fout.message || "").toLowerCase();
  if (tekst.includes("invalid login")) return t("foutGegevens");
  if (tekst.includes("not confirmed")) return t("foutBevestigen");
  if (tekst.includes("already registered")) return t("foutBestaat");
  if (tekst.includes("password")) return t("foutWachtwoord");
  return fout.message;
}

// Account maken
document.getElementById("nieuwFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const voornaam = document.getElementById("nieuwVoornaam").value.trim();
  const nieuwsbrief = document.getElementById("nieuwsbriefBijStart").checked;
  // Waarvoor gebruik je Roast Route? (optioneel, meerdere vakjes mogelijk)
  const gebruik = [...document.querySelectorAll('input[name="gebruik"]:checked')].map(v => v.value);

  // Voornaam, nieuwsbriefkeuze en gebruik onthouden tot het profiel gemaakt wordt
  localStorage.setItem("nieuwProfiel", JSON.stringify({ voornaam, nieuwsbrief, gebruik }));

  try {
    const meteenIngelogd = await maakAccount(
      document.getElementById("nieuwEmail").value.trim(),
      document.getElementById("nieuwWachtwoord").value,
      voornaam, nieuwsbrief, gebruik
    );
    // Moet het e-mailadres eerst bevestigd worden? Dan vertellen we dat.
    if (!meteenIngelogd) bericht.textContent = t("bevestigMail");
  } catch (fout) {
    localStorage.removeItem("nieuwProfiel");   // mislukt: niets onthouden
    bericht.textContent = leesbareFout(fout);
  }
};

// Inloggen
document.getElementById("loginFormulier").onsubmit = async (event) => {
  event.preventDefault();
  try {
    await logIn(
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginWachtwoord").value
    );
  } catch (fout) {
    bericht.textContent = leesbareFout(fout);
  }
};

// Wachtwoord vergeten: een resetlink sturen
document.getElementById("vergeten").onclick = async () => {
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) {
    bericht.textContent = t("eerstEmail");
    return;
  }
  try {
    await stuurWachtwoordReset(email);
    bericht.textContent = t("resetVerstuurd");
  } catch (fout) {
    bericht.textContent = leesbareFout(fout);
  }
};

// Nieuw wachtwoord bewaren (na de resetlink)
document.getElementById("resetFormulier").onsubmit = async (event) => {
  event.preventDefault();
  try {
    await kiesNieuwWachtwoord(document.getElementById("resetWachtwoord").value);
    wachtwoordHerstel = false;
    history.replaceState(null, "", location.pathname);   // "?wachtwoord=nieuw" uit het adres halen
    naInloggen();
  } catch (fout) {
    bericht.textContent = leesbareFout(fout);
  }
};

// "Eerst even rondkijken" (alleen als een account niet verplicht is)
document.getElementById("zonderAccount").hidden = ACCOUNT_VERPLICHT;
document.getElementById("zonderAccount").onclick = () => {
  rondkijken = true;
  toonScherm();
};

document.getElementById("uitlogKnop").onclick = logUit;

// Account verwijderen (GDPR: iedereen moet zijn gegevens kunnen laten wissen)
document.getElementById("verwijderAccountKnop").onclick = async () => {
  if (!confirm(t("zekerAccount"))) return;
  try {
    try { await verwijderMijnProfielfotos(); } catch (fout) { console.error(fout); }   // ook je foto wissen
    await verwijderMijnAccount();
    localStorage.removeItem("favorieten");
    favorieten = [];
    await logUit();
    alert(t("accountVerwijderd"));
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
  }
};

// De nieuwsbrief aan- of uitzetten in de app
document.getElementById("nieuwsbrief").onchange = async (event) => {
  const aan = event.target.checked;
  try {
    await bewaarProfiel({
      nieuwsbrief: aan,
      // Het moment van toestemming bewaren: dat moet je kunnen aantonen (GDPR)
      nieuwsbrief_toestemming_op: aan ? new Date().toISOString() : null
    });
  } catch (fout) {
    console.error(fout);
    event.target.checked = !aan;   // mislukt? zet het vinkje terug
  }
};

// Het profiel aanmaken of bijwerken na het inloggen
async function regelProfiel() {
  let profiel = await haalProfielOp();

  // Voornaam en nieuwsbrief: uit deze browser, of (bij een gloednieuw account)
  // uit de gegevens die bij het aanmaken van het account werden meegestuurd
  const wachtend = JSON.parse(localStorage.getItem("nieuwProfiel") || "null")
                   || (!profiel ? gebruiker.user_metadata : null);

  if (!profiel || wachtend) {
    const velden = { taal: taal };
    if (wachtend && wachtend.voornaam) velden.voornaam = wachtend.voornaam;
    // Alleen AANzetten vanuit het welkomstscherm, nooit per ongeluk uitzetten
    if (wachtend && wachtend.nieuwsbrief) {
      velden.nieuwsbrief = true;
      velden.nieuwsbrief_toestemming_op = new Date().toISOString();
    }
    // Waarvoor je Roast Route gebruikt (alleen als je iets aanvinkte)
    if (wachtend && Array.isArray(wachtend.gebruik) && wachtend.gebruik.length) {
      velden.gebruik = wachtend.gebruik;
    }
    await bewaarProfiel(velden);
    localStorage.removeItem("nieuwProfiel");
    profiel = await haalProfielOp();
  }

  mijnVoornaam = (profiel && profiel.voornaam) ? profiel.voornaam : "";
  document.getElementById("wie").textContent = mijnVoornaam || gebruiker.email;
  document.getElementById("nieuwsbrief").checked = Boolean(profiel && profiel.nieuwsbrief);
  // Profielfoto en voorkeuren (profiel.js)
  if (typeof profielGeladen === "function") profielGeladen(profiel);
}

// Wordt uitgevoerd bij het openen van de pagina, na inloggen en na uitloggen
async function naInloggen() {
  toonScherm();
  // Uitgelogd of account verwijderd? Dan het profielvenster sluiten
  const profielVenster = document.getElementById("profiel");
  if (!gebruiker && profielVenster.open) profielVenster.close();

  // Het formulier voor nieuwe bars: alleen voor jou
  document.getElementById("formulier").hidden = !isBeheerder();
  // Bars importeren uit een lijst: ook alleen voor jou
  if (typeof toonImportBlok === "function") toonImportBlok();
  // "Bar voorstellen": voor ingelogde gebruikers (niet voor de beheerder, die voegt zelf toe)
  document.getElementById("voorstelBlok").hidden = !gebruiker || isBeheerder();
  // Voorstellen van gebruikers: alleen de beheerder ziet ze
  laadVoorstellen();

  if (gebruiker) {
    try {
      await regelProfiel();

      // Favorieten uit de database, en favorieten van vóór het inloggen meenemen
      const uitDatabase = await haalFavorietenOp();
      const nogNietBewaard = favorieten.filter(id => !uitDatabase.includes(id));
      for (const id of nogNietBewaard) await bewaarFavoriet(id, true);
      favorieten = uitDatabase.concat(nogNietBewaard);
      bewaarLokaal();
    } catch (fout) {
      console.error(fout);
    }
  }
  // Je bewaarde routes (of een lege lijst na het uitloggen)
  if (typeof laadMijnRoutes === "function") laadMijnRoutes();
  teken();
  // Kwam je binnen via een gedeelde routelink? Dan tonen we die route nu
  if (typeof openGedeeldeRoute === "function") openGedeeldeRoute();
}

// ---------- 8. Kleur van de app ----------
// De app is zwart-wit: de kleuren staan vast in style.css (--accent).
// Een oude kleurkeuze uit vroegere versies wissen we.
localStorage.removeItem("kleur");

// ---------- 9. Starten ----------
async function start() {
  // Eerst luisteren naar inloggen en uitloggen, zodat we niets missen
  // (bijvoorbeeld het seintje dat iemand via de resetlink binnenkomt)
  db.auth.onAuthStateChange((gebeurtenis, sessie) => {
    gebruiker = sessie ? sessie.user : null;
    if (gebeurtenis === "PASSWORD_RECOVERY") wachtwoordHerstel = true;
    setTimeout(naInloggen, 0);   // even wachten tot Supabase klaar is
  });

  // Dan de bars ophalen
  try {
    alleStops = await haalStopsOp();
  } catch (fout) {
    // Database onbereikbaar? Dan gebruiken we stops.json als reserve
    console.error(fout);
    try {
      const antwoord = await fetch("stops.json");
      alleStops = await antwoord.json();
    } catch {
      document.getElementById("teller").textContent = t("fout");
      return;
    }
  }
  // Reviews ophalen (lukt het niet, dan werkt de rest gewoon verder)
  try {
    alleReviews = await haalReviewsOp();
  } catch (fout) {
    console.error(fout);
  }

  teken();
  zoomNaarStops();
  if (typeof openGedeeldeRoute === "function") openGedeeldeRoute();
}

start();

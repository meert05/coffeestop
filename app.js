// =====================================================
//  WAYPOUR – alle logica van de app
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
// Op de lichte kaart: elke bar is een zwarte stip met een witte rand
function kleur() {
  return "#0B0B0B";
}

// ---------- 3. Welke stops tonen we? ----------
// Verborgen bars zijn alleen voor de beheerder (de database stuurt ze ook niet naar anderen)
function magZien(stop) {
  return stop.zichtbaar !== false || isBeheerder();
}

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
    if (gekozenFilters.includes("verborgen") && stop.zichtbaar !== false) return false;
    if (!magZien(stop)) return false;   // verborgen bars: alleen voor de beheerder
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
      color: "#FFFFFF",
      weight: 2,
      fillColor: kleur(stop.type),
      fillOpacity: stop.zichtbaar === false ? 0.3 : 1,   // verborgen bars: vaag (alleen de beheerder ziet ze)
      bubblingMouseEvents: false   // een klik op een bar is geen klik op de kaart
    });
    stip.bindTooltip(esc(stop.naam));
    stip.on("click", () => {
      // Route plannen staat aan? Dan gaat de bar in (of uit) je route
      if (typeof routeKlikOpBar === "function" && routeKlikOpBar(stop)) return;
      kies(stop.id);
      toonKaartje(stop);              // op een gsm: een kaartje onderaan de kaart
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
    li.className = stop.type + (stop.id === gekozenStop ? " gekozen" : "") + (stop.zichtbaar === false ? " verborgen" : "");

    const isFavoriet = favorieten.includes(stop.id);
    const route = "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(stop.naam + " " + (stop.adres || ""));

    li.innerHTML = `
      ${stop.foto ? `<img class="foto" src="${esc(stop.foto)}" alt="">` : ""}
      <button class="ster">${isFavoriet ? "★" : "☆"}</button>
      <h3></h3>
      <small></small>
      ${mijnPlek ? `<span class="afstand">📍 ${afstandTekst(stop)}</span>` : ""}
      <p></p>
      ${openingsurenHTML(stop)}
      <div class="labels">
        ${stop.zichtbaar === false ? `<span class="label verborgenLabel">🙈 ${t("verborgen")}</span>` : ""}
        ${stop.type !== "coffee" ? `<span class="label" title="${esc(t("wielerUitleg"))}">🚴 ${t("wieler")}</span>` : ""}
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
        ${isBeheerder() ? `<button class="zichtKnop">${stop.zichtbaar === false ? t("tonen") : t("verbergen")}</button>` : ""}
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

    // Tonen of verbergen voor gebruikers (alleen de beheerder)
    const zichtKnop = li.querySelector(".zichtKnop");
    if (zichtKnop) {
      zichtKnop.onclick = async (event) => {
        event.stopPropagation();
        const nieuw = stop.zichtbaar === false;          // verborgen → tonen, en omgekeerd
        try {
          await werkStopBij(stop.id, { zichtbaar: nieuw });
          stop.zichtbaar = nieuw;
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
// Landnamen in verschillende talen → landcode, zodat "Spanje", "España" en "ES" één knop worden
const LANDCODES = {
  belgie: "BE", belgique: "BE", belgium: "BE", belgien: "BE",
  spanje: "ES", espana: "ES", espagne: "ES", spain: "ES", spanien: "ES",
  frankrijk: "FR", france: "FR", frankreich: "FR",
  nederland: "NL", "pays-bas": "NL", netherlands: "NL", niederlande: "NL",
  duitsland: "DE", allemagne: "DE", germany: "DE", deutschland: "DE",
  italie: "IT", italy: "IT", italia: "IT", italien: "IT",
  portugal: "PT",
  denemarken: "DK", danemark: "DK", denmark: "DK", danmark: "DK",
  "verenigd-koninkrijk": "GB", "royaume-uni": "GB", "united-kingdom": "GB", uk: "GB", engeland: "GB", england: "GB",
  oostenrijk: "AT", autriche: "AT", austria: "AT", osterreich: "AT",
  zwitserland: "CH", suisse: "CH", switzerland: "CH", schweiz: "CH",
  luxemburg: "LU", luxembourg: "LU"
};
function landcodeUitNaam(naam) {
  const sleutel = String(naam || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return LANDCODES[sleutel] || null;
}

function landVan(stop) {
  const code = String(stop.landcode || "").trim();
  if (/^[A-Za-z]{2}$/.test(code)) return code.toUpperCase();
  // Geen (geldige) code: afleiden uit de code-als-naam of uit de naam van het land
  return landcodeUitNaam(code) || landcodeUitNaam(stop.land || "België") || stop.land;
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
  "costa-blanca": { nl: "Costa Blanca", fr: "Costa Blanca", en: "Costa Blanca", ook: ["calp", "calpe", "xalo", "jalon", "l-albir", "albir", "l-alfas-del-pi", "alcalali", "parcent", "moraira", "teulada", "benissa", "altea", "denia", "javea", "xabia", "benidorm", "orba"] },
  lissabon:   { nl: "Lissabon",   fr: "Lisbonne",   en: "Lisbon",     ook: ["lisboa", "lisbon", "lisbonne"] },
  wenen:      { nl: "Wenen",      fr: "Vienne",     en: "Vienna",     ook: ["wien", "vienna", "vienne"] },
  munchen:    { nl: "München",    fr: "Munich",     en: "Munich",     ook: ["munich", "muenchen"] },
  keulen:     { nl: "Keulen",     fr: "Cologne",    en: "Cologne",    ook: ["koln", "koeln", "cologne"] },
  // Belgische steden en gemeenten (in het Frans en Engels soms anders)
  oudenaarde:     { nl: "Oudenaarde",     fr: "Audenarde", en: "Oudenaarde", ook: ["audenarde"] },
  geraardsbergen: { nl: "Geraardsbergen", fr: "Grammont",  en: "Geraardsbergen", ook: ["grammont"] },
  kluisbergen:    { nl: "Kluisbergen",    fr: "Kluisbergen", en: "Kluisbergen", ook: ["kwaremont", "oude-kwaremont", "ruien", "berchem-kluisbergen"] },
  brakel:         { nl: "Brakel",         fr: "Brakel",    en: "Brakel", ook: ["parike", "nederbrakel", "opbrakel"] },
  roeselare:      { nl: "Roeselare",      fr: "Roulers",   en: "Roeselare", ook: ["roulers"] },
  tongeren:       { nl: "Tongeren",       fr: "Tongres",   en: "Tongeren", ook: ["tongres"] },
  halle:          { nl: "Halle",          fr: "Hal",       en: "Halle", ook: ["hal"] },
  gooik:          { nl: "Gooik",          fr: "Gooik",     en: "Gooik", ook: ["pajottenland"] },
  kortrijk:       { nl: "Kortrijk",       fr: "Courtrai",  en: "Kortrijk", ook: ["courtrai"] },
  brugge:         { nl: "Brugge",         fr: "Bruges",    en: "Bruges", ook: ["bruges"] },
  leuven:         { nl: "Leuven",         fr: "Louvain",   en: "Leuven", ook: ["louvain"] },
  mechelen:       { nl: "Mechelen",       fr: "Malines",   en: "Mechelen", ook: ["malines"] },
  ieper:          { nl: "Ieper",          fr: "Ypres",     en: "Ypres", ook: ["ypres"] },
  ronse:          { nl: "Ronse",          fr: "Renaix",    en: "Ronse", ook: ["renaix"] },
  zottegem:       { nl: "Zottegem",       fr: "Zottegem",  en: "Zottegem" },
  knokke:         { nl: "Knokke",         fr: "Knokke",    en: "Knokke", ook: ["knokke-heist", "heist", "duinbergen"] },
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

// ---------- België: vaste steden, en daarbuiten per provincie ----------
const VASTE_STEDEN = ["antwerpen", "gent", "brussel", "leuven", "knokke"];

const PROVINCIES = {
  "west-vlaanderen": { nl: "West-Vlaanderen",      fr: "Flandre-Occidentale", en: "West Flanders" },
  "oost-vlaanderen": { nl: "Oost-Vlaanderen",      fr: "Flandre-Orientale",   en: "East Flanders" },
  "antwerpen":       { nl: "Provincie Antwerpen",  fr: "Province d'Anvers",   en: "Antwerp Province" },
  "vlaams-brabant":  { nl: "Vlaams-Brabant",       fr: "Brabant flamand",     en: "Flemish Brabant" },
  "limburg":         { nl: "Limburg",              fr: "Limbourg",            en: "Limburg" },
  "waals-brabant":   { nl: "Waals-Brabant",        fr: "Brabant wallon",      en: "Walloon Brabant" },
  "henegouwen":      { nl: "Henegouwen",           fr: "Hainaut",             en: "Hainaut" },
  "luik":            { nl: "Luik",                 fr: "Liège",               en: "Liège" },
  "namen":           { nl: "Namen",                fr: "Namur",               en: "Namur" },
  "luxemburg":       { nl: "Luxemburg",            fr: "Luxembourg",          en: "Luxembourg" },
  "overig":          { nl: "Rest van België",      fr: "Reste de la Belgique", en: "Rest of Belgium" }
};
// Andere schrijfwijzen (bv. als OpenStreetMap de naam in het Frans of Engels geeft)
const PROVINCIE_OOK = {
  "flandre-occidentale": "west-vlaanderen", "west-flanders": "west-vlaanderen",
  "flandre-orientale": "oost-vlaanderen", "east-flanders": "oost-vlaanderen",
  "provincie-antwerpen": "antwerpen", "anvers": "antwerpen",
  "brabant-flamand": "vlaams-brabant", "flemish-brabant": "vlaams-brabant",
  "limbourg": "limburg", "brabant-wallon": "waals-brabant", "walloon-brabant": "waals-brabant",
  "hainaut": "henegouwen", "liege": "luik", "namur": "namen", "luxembourg": "luxemburg"
};

function provincieSleutel(naam) {
  const slug = stadSlug(naam);
  if (PROVINCIES[slug]) return slug;
  return PROVINCIE_OOK[slug] || null;
}

// De provincie uit een Belgische postcode halen (bv. "9700 Oudenaarde" → Oost-Vlaanderen)
function provincieUitPostcode(adres) {
  const gevonden = String(adres || "").match(/\b(\d{4})\b/);
  if (!gevonden) return null;
  const n = Number(gevonden[1]);
  if (n < 1300) return null;                 // Brussel
  if (n < 1500) return "waals-brabant";
  if (n < 2000) return "vlaams-brabant";
  if (n < 3000) return "antwerpen";
  if (n < 3500) return "vlaams-brabant";
  if (n < 4000) return "limburg";
  if (n < 5000) return "luik";
  if (n < 6000) return "namen";
  if (n < 6600) return "henegouwen";
  if (n < 7000) return "luxemburg";
  if (n < 8000) return "henegouwen";
  if (n < 9000) return "west-vlaanderen";
  return "oost-vlaanderen";
}

// De groep van een bar: in België een vaste stad of anders de provincie, in het buitenland de stad
function groepVan(stop) {
  if (landVan(stop) === "BE") {
    // Hoort de bar bij een vaste stad? We kijken naar de ligging (niet naar wat er vroeger bewaard werd),
    // en naar de gemeente: een bar in "Leuven" of "Knokke-Heist" hoort altijd bij die stad.
    const viaLigging = stadVan(stop.lat, stop.lng);
    if (VASTE_STEDEN.includes(viaLigging)) return viaLigging;
    const viaGemeente = stop.plaats ? stadSleutel(stop.plaats) : null;
    if (VASTE_STEDEN.includes(viaGemeente)) return viaGemeente;
    if (VASTE_STEDEN.includes(stop.stad)) return stop.stad;
    const provincie = (stop.provincie && provincieSleutel(stop.provincie)) || provincieUitPostcode(stop.adres);
    return "prov:" + (provincie || "overig");
  }
  if (stop.plaats) return stadSleutel(stop.plaats);
  return landNaam(landVan(stop));
}

// De naam op de knop, in de gekozen taal
const VASTE_REGIOS = { antwerpen: "antwerpen", gent: "gent", brussel: "brussel" };
function groepNaam(groep) {
  if (VASTE_REGIOS[groep]) return t(VASTE_REGIOS[groep]);
  if (groep.startsWith("prov:")) {
    const p = PROVINCIES[groep.slice(5)];
    return p ? (p[taal] || p.nl) : groep.slice(5);
  }
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
    const verborgen = alleStops.filter(s => s.zichtbaar === false).length;
    filters.push(["verborgen", "🙈 " + t("verborgen") + " (" + verborgen + ")"]);
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
  // Wat bedoelen we met "cycling-friendly"? Uitleg zodra die filter aanstaat
  const uitleg = document.getElementById("filterUitleg");
  uitleg.hidden = !gekozenFilters.includes("wieler");
  uitleg.textContent = t("wielerUitleg");
  const wielerKnop = rij.children[1];
  if (wielerKnop) wielerKnop.title = t("wielerUitleg");
}

function tekenFilters() {
  tekenCategorieen();
  // Welke landen komen voor in onze bars?
  const landen = [...new Set(alleStops.filter(magZien).map(landVan))]
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

  const volgorde = VASTE_STEDEN;
  const groepen = [...new Set(alleStops.filter(s => magZien(s) && landVan(s) === gekozenLand).map(groepVan))]
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
  if (typeof importPlaatsRij !== "undefined" && importPlaatsRij !== null) return;   // dan zet import.js een bar
  nieuwePlek = [event.latlng.lat, event.latlng.lng];
  document.getElementById("plekTekst").textContent = t("plekGekozen");
  teken();
});

// Welke vaste stad ligt vlakbij? [breedte, lengte, straal in km]. Anders: "hellingen" (= de rest van België)
function stadVan(lat, lng) {
  const centra = {
    antwerpen: [51.2194, 4.4025, 9],
    gent:      [51.0543, 3.7174, 9],
    brussel:   [50.8467, 4.3525, 9],
    leuven:    [50.8798, 4.7005, 7],
    knokke:    [51.3450, 3.2870, 6]
  };
  for (const [stad, [clat, clng, straal]] of Object.entries(centra)) {
    const km = Math.hypot((lat - clat) * 111, (lng - clng) * 70);
    if (km < straal) return stad;
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
    provincie: gevondenProvincie || null,
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
    gevondenProvincie = "";
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
let gevondenProvincie = "";  // en de provincie

// ---------- Een adres opzoeken ----------
// 1. OpenStreetMap (Nominatim): precies, maar streng met schrijfwijzen.
// 2. Photon (Komoot): vergevingsgezinder, handig in het buitenland
//    ("Avenida de la Paz" vindt ook "Avinguda de la Pau").
// Met { grondig: true } proberen we daarna ook de straat zonder huisnummer en postcode.
async function zoekNominatim(adres) {
  const url = "https://nominatim.openstreetmap.org/search"
            + "?format=jsonv2&addressdetails=1&limit=1&accept-language=" + (typeof taal !== "undefined" ? taal : "nl")
            + "&q=" + encodeURIComponent(adres);
  const resultaten = await (await fetch(url)).json();
  if (!Array.isArray(resultaten) || resultaten.length === 0) return null;
  const r = resultaten[0], a = r.address || {};
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    land: a.country || "",
    landcode: (a.country_code || "").toUpperCase(),   // bv. "BE" of "ES"
    // Een adres heeft een "city", "town" of "village", afhankelijk van hoe groot de plaats is
    plaats: a.city || a.town || a.village || a.municipality || "",
    provincie: a.province || ""                        // bv. "Oost-Vlaanderen"
  };
}

async function zoekPhoton(adres) {
  const lang = ["fr", "en", "de"].includes(typeof taal !== "undefined" ? taal : "") ? taal : "default";
  const url = "https://photon.komoot.io/api/?limit=1&lang=" + lang + "&q=" + encodeURIComponent(adres);
  const data = await (await fetch(url)).json();
  const f = data && Array.isArray(data.features) ? data.features[0] : null;
  if (!f) return null;
  const p = f.properties || {};
  return {
    lat: Number(f.geometry.coordinates[1]),
    lng: Number(f.geometry.coordinates[0]),
    land: p.country || "",
    landcode: (p.countrycode || "").toUpperCase(),
    plaats: p.city || p.town || p.village || p.locality || p.district || "",
    provincie: ""
  };
}

// "Avenida de la Paz 20, 03724 Moraira" → "Avenida de la Paz, Moraira"
function zonderHuisnummer(adres) {
  return String(adres)
    .replace(/\b\d+[a-zA-Z]?\b/g, "")          // huisnummers en postcodes weg
    .replace(/\s+,/g, ",")
    .replace(/,\s*(,\s*)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

let laatsteNominatim = 0;
async function rustigNominatim(adres) {        // OpenStreetMap vraagt hooguit één zoekvraag per seconde
  const wachten = laatsteNominatim + 1100 - Date.now();
  if (wachten > 0) await new Promise(klaar => setTimeout(klaar, wachten));
  laatsteNominatim = Date.now();
  return zoekNominatim(adres);
}

async function zoekAdres(adres, opties = {}) {
  const pogingen = [
    () => rustigNominatim(adres),
    () => zoekPhoton(adres)
  ];
  const kort = zonderHuisnummer(adres);
  if (opties.grondig && kort && kort !== adres) {
    pogingen.push(async () => { const g = await rustigNominatim(kort); return g && { ...g, ongeveer: true }; });
    pogingen.push(async () => { const g = await zoekPhoton(kort); return g && { ...g, ongeveer: true }; });
  }
  for (const poging of pogingen) {
    try {
      const gevonden = await poging();
      if (gevonden && Number.isFinite(gevonden.lat) && Number.isFinite(gevonden.lng)) return gevonden;
    } catch (fout) {
      console.warn("Adres zoeken: een poging lukte niet", fout);
    }
  }
  return null;
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
    const gevonden = await zoekAdres(adres, { grondig: true });
    if (!gevonden) {
      tekst.textContent = t("adresNietGevonden");
      return;
    }
    nieuwePlek = [gevonden.lat, gevonden.lng];
    document.getElementById("nieuwLand").value = gevonden.land;
    gevondenLandcode = gevonden.landcode;
    gevondenProvincie = gevonden.provincie;
    document.getElementById("nieuwPlaats").value = gevonden.plaats;
    tekst.textContent = gevonden.ongeveer ? t("adresOngeveer") : t("adresGevonden");
    kaart.setView(nieuwePlek, gevonden.ongeveer ? 16 : 17);   // inzoomen op de gevonden plek
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
  document.getElementById("mailCheck").hidden = welke !== "mail";
  document.getElementById("tabs").hidden = welke === "reset" || welke === "mail";
  document.getElementById("tabNieuw").classList.toggle("actief", welke === "nieuw");
  document.getElementById("tabLogin").classList.toggle("actief", welke === "login");
  bericht.textContent = "";
}
document.getElementById("tabNieuw").onclick = () => toonTab("nieuw");

// ---------- "Bevestig je e-mailadres" ----------
let mailCheckAdres = "";
function toonMailCheck(email) {
  mailCheckAdres = email;
  toonTab("mail");
  document.getElementById("mailCheckAdres").textContent = email;
  document.getElementById("mailCheck").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.getElementById("mailNaarLogin").onclick = () => {
  toonTab("login");
  document.getElementById("loginEmail").value = mailCheckAdres;
  document.getElementById("loginWachtwoord").focus();
};
document.getElementById("mailAnderAdres").onclick = () => {
  toonTab("nieuw");
  document.getElementById("nieuwEmail").focus();
};
document.getElementById("mailOpnieuw").onclick = async () => {
  const knop = document.getElementById("mailOpnieuw");
  knop.disabled = true;
  try {
    await stuurBevestigingOpnieuw(mailCheckAdres, await haalCaptchaToken());
    bericht.textContent = t("mailOpnieuwGestuurd");
  } catch (fout) {
    if (!fout.captcha) bericht.textContent = leesbareFout(fout);   // een captchafout staat er al, met knop
  } finally {
    resetCaptcha();
    setTimeout(() => { knop.disabled = false; }, 30000);   // niet blijven klikken: 30 seconden wachten
  }
};
document.getElementById("tabLogin").onclick = () => toonTab("login");

// Foutmeldingen van Supabase omzetten naar een duidelijke zin
function leesbareFout(fout) {
  const tekst = (fout.message || "").toLowerCase();
  if (tekst.includes("captcha")) return t("captchaServer");
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
  // Waarvoor gebruik je Waypour? (optioneel, meerdere vakjes mogelijk)
  const gebruik = [...document.querySelectorAll('input[name="gebruik"]:checked')].map(v => v.value);

  // Voornaam, nieuwsbriefkeuze en gebruik onthouden tot het profiel gemaakt wordt
  localStorage.setItem("nieuwProfiel", JSON.stringify({ voornaam, nieuwsbrief, gebruik }));

  try {
    const meteenIngelogd = await maakAccount(
      document.getElementById("nieuwEmail").value.trim(),
      document.getElementById("nieuwWachtwoord").value,
      voornaam, nieuwsbrief, gebruik,
      await haalCaptchaToken()               // bewijs dat je geen robot bent
    );
    // Moet het e-mailadres eerst bevestigd worden? Dan tonen we een duidelijk scherm.
    if (!meteenIngelogd) toonMailCheck(document.getElementById("nieuwEmail").value.trim());
  } catch (fout) {
    localStorage.removeItem("nieuwProfiel");   // mislukt: niets onthouden
    if (!fout.captcha) bericht.textContent = leesbareFout(fout);   // een captchafout staat er al, met knop
  } finally {
    resetCaptcha();
  }
};

// Inloggen
document.getElementById("loginFormulier").onsubmit = async (event) => {
  event.preventDefault();
  try {
    await logIn(
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginWachtwoord").value,
      await haalCaptchaToken()
    );
    bericht.textContent = "";
  } catch (fout) {
    // Nog niet bevestigd? Dan het scherm met uitleg en "opnieuw sturen" tonen
    if ((fout.message || "").toLowerCase().includes("not confirmed")) {
      toonMailCheck(document.getElementById("loginEmail").value.trim());
      bericht.textContent = t("foutBevestigen");
    } else {
      if (!fout.captcha) bericht.textContent = leesbareFout(fout);   // een captchafout staat er al, met knop
    }
  } finally {
    resetCaptcha();
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
    await stuurWachtwoordReset(email, await haalCaptchaToken());
    bericht.textContent = t("resetVerstuurd");
  } catch (fout) {
    if (!fout.captcha) bericht.textContent = leesbareFout(fout);   // een captchafout staat er al, met knop
  } finally {
    resetCaptcha();
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
    if (!fout.captcha) bericht.textContent = leesbareFout(fout);   // een captchafout staat er al, met knop
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
    // Waarvoor je Waypour gebruikt (alleen als je iets aanvinkte)
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

  // Beheerder ingelogd? Dan opnieuw de bars ophalen: zo krijg je ook de verborgen bars.
  // Uitgelogd? Dan de verborgen bars meteen uit de lijst halen.
  if (isBeheerder()) {
    try { alleStops = await haalStopsOp(); } catch (fout) { console.error(fout); }
  } else {
    alleStops = alleStops.filter(s => s.zichtbaar !== false);
  }

  if (gebruiker) {
    try {
      await regelProfiel();
      // Reviews zijn alleen leesbaar voor ingelogde gebruikers: nu ophalen
      try { alleReviews = await haalReviewsOp(); } catch (fout) { console.error(fout); }

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


// =====================================================
//  GSM: kaartje op de kaart en een knop "Lijst / Kaart"
// =====================================================
const opGsm = window.matchMedia("(max-width: 560px)");

// Klik je op een stip, dan zie je op een gsm meteen een kaartje onderaan de kaart
const kaartje = document.createElement("div");
kaartje.id = "kaartje";
kaartje.hidden = true;
document.getElementById("kaart").appendChild(kaartje);
L.DomEvent.disableClickPropagation(kaartje);
L.DomEvent.disableScrollPropagation(kaartje);

function toonKaartje(stop) {
  if (!opGsm.matches) return;
  kaartje.innerHTML = `
    ${stop.foto ? `<img src="${esc(stop.foto)}" alt="">` : ""}
    <div class="tekst"><b></b><small></small><p></p></div>
    <button type="button" class="sluiten" aria-label="Sluiten">✕</button>
    <button type="button" class="meer">${t("meerInfo")}</button>`;
  kaartje.querySelector("b").textContent = stop.naam;
  kaartje.querySelector("small").textContent = stop.adres || "";
  kaartje.querySelector("p").textContent = stop["info_" + taal] || stop.info || "";
  kaartje.hidden = false;
  kaartje.querySelector(".sluiten").onclick = () => { kaartje.hidden = true; };
  kaartje.querySelector(".meer").onclick = () => {
    kaartje.hidden = true;
    const li = document.querySelector("#lijst > li.gekozen");
    if (li) li.scrollIntoView({ behavior: "smooth", block: "start" });
  };
}
kaart.on("click", () => { kaartje.hidden = true; });

// Een zwevende knop onderaan: van de kaart naar de lijst, en terug
const wisselKnop = document.createElement("button");
wisselKnop.id = "kaartLijstKnop";
wisselKnop.type = "button";
document.getElementById("app").appendChild(wisselKnop);
let kaartInBeeld = true;

function tekenWisselKnop() {
  const aantal = document.querySelectorAll("#lijst > li").length;
  wisselKnop.textContent = kaartInBeeld ? t("naarLijst") + " · " + aantal : t("naarKaart");
}
if ("IntersectionObserver" in window) {
  new IntersectionObserver((items) => {
    kaartInBeeld = items[0].isIntersecting;
    tekenWisselKnop();
  }, { threshold: 0.35 }).observe(document.getElementById("kaart"));
}
wisselKnop.onclick = () => {
  if (kaartInBeeld) document.getElementById("teller").scrollIntoView({ behavior: "smooth", block: "start" });
  else document.getElementById("steden").scrollIntoView({ behavior: "smooth", block: "start" });
};
// De lijst verandert (filter, zoeken, taal): het aantal op de knop mee aanpassen
new MutationObserver(tekenWisselKnop).observe(document.getElementById("lijst"), { childList: true });
tekenWisselKnop();

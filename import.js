// =====================================================
//  BARS IMPORTEREN – alleen voor de beheerder
// =====================================================
//
// Zo werkt het:
//  1. Kies een lijst (.json of .csv) met bars: naam, adres, plaats, land, landcode, type, info.
//  2. De app zoekt elk adres op de kaart (OpenStreetMap), rustig één per seconde.
//  3. Je kijkt de lijst na: wat al bestaat of niet gevonden werd, staat niet aangevinkt.
//  4. Klik op "Toevoegen" en de aangevinkte bars staan op de kaart.

let importRijen = [];        // de ingelezen bars, met hun status
let importBezig = false;

const importBlok = document.getElementById("importBlok");
const importMelding = document.getElementById("importMelding");

// Alleen de beheerder ziet het importblok (wordt opgeroepen na het inloggen)
function toonImportBlok() {
  importBlok.hidden = !isBeheerder();
}

// Een id maken uit een naam: "Café du Cycliste" → "cafe-du-cycliste"
function maakId(tekst) {
  return String(tekst).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------- Het bestand inlezen ----------
document.getElementById("importBestand").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";
  if (!bestand || importBezig) return;

  let rijen;
  try {
    const tekst = await bestand.text();
    rijen = bestand.name.toLowerCase().endsWith(".csv") ? leesCsv(tekst) : JSON.parse(tekst);
    if (!Array.isArray(rijen)) throw new Error("Geen lijst");
  } catch (fout) {
    importMelding.textContent = t("importFout");
    return;
  }

  importRijen = rijen
    .filter(r => r && r.naam && r.adres)
    .map(r => ({ ...r, status: "wachten", aan: false, gevonden: null }));
  if (importRijen.length === 0) { importMelding.textContent = t("importFout"); return; }

  await zoekAlleAdressen();
};

// Een eenvoudige CSV: eerste regel = kolomnamen, gescheiden door komma's of puntkomma's
function leesCsv(tekst) {
  const regels = tekst.split(/\r?\n/).filter(r => r.trim());
  const scheiding = regels[0].includes(";") ? ";" : ",";
  const splits = (regel) => {
    const velden = [];
    let huidig = "", tussenAanhalingstekens = false;
    for (const teken of regel) {
      if (teken === '"') tussenAanhalingstekens = !tussenAanhalingstekens;
      else if (teken === scheiding && !tussenAanhalingstekens) { velden.push(huidig); huidig = ""; }
      else huidig += teken;
    }
    velden.push(huidig);
    return velden.map(v => v.trim());
  };
  const koppen = splits(regels[0]).map(k => k.toLowerCase());
  return regels.slice(1).map(regel => {
    const velden = splits(regel);
    return Object.fromEntries(koppen.map((k, i) => [k, velden[i] || ""]));
  });
}

// ---------- Alle adressen opzoeken (één per seconde, zo vraagt OpenStreetMap het) ----------
async function zoekAlleAdressen() {
  importBezig = true;
  const bestaandeIds = new Set(alleStops.map(s => s.id));
  // Staat een bar met dezelfde naam al in dezelfde stad (of vlakbij)?
  const zelfdeNaam = (r) => alleStops.filter(s => maakId(s.naam) === maakId(r.naam));
  const zelfdeStad = (r, s) => {
    const plaats = maakId(r.plaats || "");
    return plaats && (plaats === maakId(s.plaats || "") || plaats === maakId(s.stad || ""));
  };

  for (let i = 0; i < importRijen.length; i++) {
    const r = importRijen[i];
    r.id = maakId(r.naam);
    if (bestaandeIds.has(r.id)) r.id = maakId(r.naam + " " + (r.plaats || ""));

    // Bestaat deze bar al op de kaart? (zelfde id, of zelfde naam in dezelfde stad)
    if (bestaandeIds.has(r.id) || zelfdeNaam(r).some(s => zelfdeStad(r, s))) {
      r.status = "bestaat";
      tekenImportLijst();
      continue;
    }

    importMelding.textContent = t("importZoeken") + " " + (i + 1) + "/" + importRijen.length;
    r.status = "zoeken";
    tekenImportLijst();

    try {
      // Eerst het adres, anders naam + plaats
      let gevonden = await zoekAdres(r.adres);
      if (!gevonden) {
        await wacht(1100);
        gevonden = await zoekAdres(r.naam + ", " + (r.plaats || ""));
      }
      r.gevonden = gevonden;
      if (!gevonden) {
        r.status = "nietGevonden";
      } else if (zelfdeNaam(r).some(s => afstandKm([s.lat, s.lng], [gevonden.lat, gevonden.lng]) < 2)) {
        r.status = "bestaat";               // zelfde naam, en minder dan 2 km verder: dat is dezelfde bar
      } else if (r.landcode && gevonden.landcode && r.landcode.toUpperCase() !== gevonden.landcode) {
        r.status = "anderLand";             // gevonden, maar in een ander land dan verwacht
      } else {
        r.status = "gevonden";
        r.aan = r.zeker !== false;           // "niet zeker" zetten we niet vanzelf aan
      }
    } catch (fout) {
      console.error(fout);
      r.status = "nietGevonden";
    }
    bestaandeIds.add(r.id);                  // twee keer dezelfde bar in de lijst? Dan maar één keer
    tekenImportLijst();
    await wacht(1100);
  }

  importBezig = false;
  const klaar = importRijen.filter(r => r.aan).length;
  importMelding.textContent = t("importKlaar").replace("{n}", klaar);
  tekenImportLijst();
}

function wacht(ms) {
  return new Promise(klaar => setTimeout(klaar, ms));
}

// ---------- De lijst tonen ----------
const IMPORT_STATUS = {
  wachten: "·", zoeken: "…", gevonden: "✓", nietGevonden: "✗", bestaat: "=", anderLand: "⚠️"
};

function tekenImportLijst() {
  const lijst = document.getElementById("importLijst");
  lijst.innerHTML = importRijen.map((r, i) => `
    <li class="${r.status}">
      <label class="vinkje">
        <input type="checkbox" data-rij="${i}" ${r.aan ? "checked" : ""}
               ${r.status === "gevonden" || r.status === "anderLand" ? "" : "disabled"}>
        <span>
          <b>${esc(r.naam)}</b>
          <small>${esc(r.plaats || "")} · ${r.type === "both" ? "🚴 " : ""}${IMPORT_STATUS[r.status]} ${t("importStatus_" + r.status)}${r.zeker === false ? " · " + t("importNietZeker") : ""}</small>
        </span>
      </label>
      ${r.gevonden ? `<button type="button" data-toon="${i}" aria-label="Op de kaart">📍</button>` : ""}
    </li>`).join("");

  lijst.querySelectorAll("[data-rij]").forEach(vakje => {
    vakje.onchange = () => {
      importRijen[Number(vakje.dataset.rij)].aan = vakje.checked;
      tekenImportKnop();
    };
  });
  lijst.querySelectorAll("[data-toon]").forEach(knop => {
    knop.onclick = () => {
      const g = importRijen[Number(knop.dataset.toon)].gevonden;
      kaart.setView([g.lat, g.lng], 16);
      document.getElementById("kaart").scrollIntoView({ behavior: "smooth", block: "center" });
    };
  });
  tekenImportKnop();
}

function tekenImportKnop() {
  const aantal = importRijen.filter(r => r.aan).length;
  const knop = document.getElementById("importToevoegen");
  knop.hidden = importRijen.length === 0;
  knop.disabled = importBezig || aantal === 0;
  knop.textContent = t("importToevoegen").replace("{n}", aantal);
}

// ---------- De aangevinkte bars toevoegen ----------
document.getElementById("importToevoegen").onclick = async () => {
  const teDoen = importRijen.filter(r => r.aan && r.gevonden);
  if (teDoen.length === 0 || importBezig) return;
  importBezig = true;
  tekenImportKnop();

  let gelukt = 0;
  for (const r of teDoen) {
    const g = r.gevonden;
    const landcode = (r.landcode || g.landcode || "").toUpperCase();
    const stop = {
      id: r.id,
      naam: r.naam.trim(),
      adres: r.adres.trim(),
      land: r.land || g.land || "",
      landcode: landcode,
      plaats: r.plaats || g.plaats || "",
      // In België: onze vaste regio's; elders groeperen we per gemeente
      stad: landcode === "BE" ? stadVan(g.lat, g.lng) : "buitenland",
      type: r.type === "both" || r.type === "wieler" ? "both" : "coffee",
      lat: Number(g.lat.toFixed(5)),
      lng: Number(g.lng.toFixed(5)),
      info: (r.info || "").trim(),
      provincie: r.provincie || g.provincie || null,
      kenmerken: leesKenmerken(r)
    };
    try {
      await voegStopToeInDatabase(stop);
      alleStops.push(stop);
      r.status = "toegevoegd";
      r.aan = false;
      gelukt++;
    } catch (fout) {
      console.error(fout);
      r.status = "fout";
      r.fout = fout.message;
    }
    importMelding.textContent = t("importToevoegenBezig") + " " + gelukt + "/" + teDoen.length;
  }

  importBezig = false;
  importMelding.textContent = t("importToegevoegd").replace("{n}", gelukt);
  tekenImportLijst();
  gekozenLand = "alles";
  gekozenStad = "alles";
  teken();
  zoomNaarStops();
};

// Kenmerken uit de lijst: een JSON-lijst ["laptop"], of in een CSV een kolom laptop/pc met ja/yes
function leesKenmerken(r) {
  if (Array.isArray(r.kenmerken)) return r.kenmerken.filter(k => KENMERKEN[k]);
  const laptop = String(r.laptop || r.pc || r["pc friendly"] || "").trim();
  return /^(ja|yes|y|1|true|x)$/i.test(laptop) ? ["laptop"] : [];
}

// De statussen "toegevoegd" en "fout" horen er ook bij
IMPORT_STATUS.toegevoegd = "✓";
IMPORT_STATUS.fout = "✗";

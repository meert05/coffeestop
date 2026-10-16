// =====================================================
//  WAYPOUR – anonieme cijfers per bar (tellers.sql)
// =====================================================
// * Tellen: hoe vaak een bar bekeken wordt, een route krijgt, in een fietsroute komt,
//   gekozen wordt voor een rit of als favoriet bewaard wordt. We bewaren niet wie.
// * De beheerder ziet de cijfers in het bar-scherm (beheer-modus) en in "📊 Cijfers",
//   en kan per bar een maandrapport kopiëren om naar de bar te mailen (bar-pakket).

const CIJFER_SOORTEN = [
  { sleutel: "bekeken",  kort: "Bekeken",   nl: "keer bekeken",                    fr: "fois consulté" },
  { sleutel: "route",    kort: "Route",     nl: "keer de route opgevraagd",        fr: "fois l'itinéraire demandé" },
  { sleutel: "in_route", kort: "In route",  nl: "keer in een fietsroute gezet",    fr: "fois ajouté à un parcours vélo" },
  { sleutel: "rit",      kort: "Rit",       nl: "keer gekozen voor een groepsrit", fr: "fois choisi pour une sortie en groupe" },
  { sleutel: "favoriet", kort: "Favoriet",  nl: "keer als favoriet bewaard",       fr: "fois ajouté aux favoris" }
];

// ---------- Tellen ----------
// Eén keer per bar en per soort zolang de pagina openstaat (niets op je toestel bewaard)
const alGeteld = new Set();
function telBar(stopId, soort) {
  if (!stopId || isBeheerder() || typeof telBarInDatabase !== "function") return;
  const sleutel = stopId + "|" + soort;
  if (alGeteld.has(sleutel)) return;
  alGeteld.add(sleutel);
  telBarInDatabase(stopId, soort).catch(fout => console.warn("Tellen mislukt:", fout.message));
}

// ---------- Datums ----------
function datumTekst(d) {   // "2026-10-12", in je eigen tijdzone
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dagenGeleden(n) {
  const d = new Date(); d.setDate(d.getDate() - n + 1);
  return datumTekst(d);
}
function vorigeMaand() {
  const nu = new Date();
  const begin = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
  const einde = new Date(nu.getFullYear(), nu.getMonth(), 0);
  return { sinds: datumTekst(begin), tot: datumTekst(einde), begin };
}
function maandNaam(d, taalCode) {
  return d.toLocaleDateString(taalCode === "fr" ? "fr-BE" : "nl-BE", { month: "long", year: "numeric" });
}

// ---------- Cijfers ophalen (5 minuten onthouden) ----------
const cijferGeheugen = {};
async function cijfersPerBar(sinds, tot = null) {
  const sleutel = sinds + "|" + (tot || "");
  const bewaard = cijferGeheugen[sleutel];
  if (bewaard && Date.now() - bewaard.tijd < 5 * 60 * 1000) return bewaard.perBar;
  const rijen = await haalBarCijfersOp(sinds, tot);
  const perBar = {};
  for (const r of rijen) {
    perBar[r.stop_id] = perBar[r.stop_id] || {};
    perBar[r.stop_id][r.soort] = Number(r.aantal) || 0;
  }
  cijferGeheugen[sleutel] = { tijd: Date.now(), perBar };
  return perBar;
}

// ---------- In het bar-scherm (beheer-modus) ----------
function barCijfersHTML(stop) {
  if (!inBeheer() || stop.id !== gekozenStop) return "";
  return `<div class="barCijfers"><h4>📊 Laatste 30 dagen</h4><div class="cijferTegels">…</div>
    <div class="rapportKnoppen">
      <button type="button" class="rapportKnop" data-taal="nl">📋 Maandrapport NL</button>
      <button type="button" class="rapportKnop" data-taal="fr">📋 Rapport FR</button>
    </div><small class="rapportMelding"></small></div>`;
}

async function vulBarCijfers(li, stop) {
  const blok = li.querySelector(".barCijfers");
  if (!blok) return;
  blok.onclick = (event) => event.stopPropagation();
  const tegels = blok.querySelector(".cijferTegels");
  try {
    const perBar = await cijfersPerBar(dagenGeleden(30));
    const c = perBar[stop.id] || {};
    tegels.innerHTML = CIJFER_SOORTEN.map(s =>
      `<div class="tegel"><b>${c[s.sleutel] || 0}</b><span>${s.kort}</span></div>`).join("");
  } catch (fout) {
    tegels.textContent = "Cijfers niet geladen. Voerde je tellers.sql al uit? (" + fout.message + ")";
  }
  blok.querySelectorAll(".rapportKnop").forEach(knop => {
    knop.onclick = () => kopieerRapport(stop, knop.dataset.taal, blok.querySelector(".rapportMelding"));
  });
}

// Een kort mailtje met de cijfers van vorige maand, klaar om te plakken
async function kopieerRapport(stop, taalCode, melding) {
  try {
    const maand = vorigeMaand();
    const c = (await cijfersPerBar(maand.sinds, maand.tot))[stop.id] || {};
    const regels = CIJFER_SOORTEN.map(s => `• ${c[s.sleutel] || 0} ${s[taalCode]}`).join("\n");
    const tekst = taalCode === "fr"
      ? `Bonjour,\n\nVoici les chiffres de ${stop.naam} sur Waypour en ${maandNaam(maand.begin, "fr")} :\n\n${regels}\n\nCes chiffres sont anonymes : nous ne savons pas qui a consulté votre bar.\n\nÀ bientôt,\nMilan – Waypour`
      : `Hallo,\n\nZo deed ${stop.naam} het in ${maandNaam(maand.begin, "nl")} op Waypour:\n\n${regels}\n\nDe cijfers zijn anoniem: we weten niet wie je bar bekeek.\n\nGroetjes,\nMilan – Waypour`;
    await navigator.clipboard.writeText(tekst);
    melding.textContent = "Gekopieerd ✓ Plak het in een mail naar de bar.";
  } catch (fout) {
    melding.textContent = "Kopiëren lukte niet: " + fout.message;
  }
}

// ---------- Het overzicht "📊 Cijfers" (beheer-modus) ----------
let cijferPeriode = "30";
let cijferRijen = [];

function periodeGrenzen(periode) {
  if (periode === "vorigeMaand") { const m = vorigeMaand(); return { sinds: m.sinds, tot: m.tot }; }
  return { sinds: dagenGeleden(Number(periode)), tot: null };
}

async function tekenCijferOverzicht() {
  const vak = document.getElementById("cijfersTabel");
  document.querySelectorAll("#cijfersPeriode button").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.periode === cijferPeriode));
  vak.textContent = "Laden…";
  try {
    const { sinds, tot } = periodeGrenzen(cijferPeriode);
    const perBar = await cijfersPerBar(sinds, tot);
    cijferRijen = alleStops
      .map(stop => ({ stop, c: perBar[stop.id] || {} }))
      .filter(r => CIJFER_SOORTEN.some(s => r.c[s.sleutel]))
      .sort((a, b) => (b.c.bekeken || 0) - (a.c.bekeken || 0) || a.stop.naam.localeCompare(b.stop.naam));
    const totaal = {};
    for (const s of CIJFER_SOORTEN) totaal[s.sleutel] = cijferRijen.reduce((som, r) => som + (r.c[s.sleutel] || 0), 0);
    const zonder = alleStops.filter(s => s.zichtbaar !== false).length - cijferRijen.length;

    vak.innerHTML = `<table class="cijferTabel">
      <thead><tr><th>Bar</th>${CIJFER_SOORTEN.map(s => `<th>${s.kort}</th>`).join("")}</tr></thead>
      <tbody>
        <tr class="totaal"><td>Totaal</td>${CIJFER_SOORTEN.map(s => `<td>${totaal[s.sleutel]}</td>`).join("")}</tr>
        ${cijferRijen.map(r => `<tr><td>${esc(r.stop.naam)}</td>${CIJFER_SOORTEN.map(s => `<td>${r.c[s.sleutel] || 0}</td>`).join("")}</tr>`).join("")}
      </tbody></table>
      ${zonder > 0 ? `<p class="uitleg">${zonder} zichtbare bars hebben in deze periode nog geen cijfers.</p>` : ""}`;
  } catch (fout) {
    vak.textContent = "Cijfers niet geladen. Voerde je tellers.sql al uit? (" + fout.message + ")";
  }
}

function openCijfers() {
  const venster = document.getElementById("cijfersVenster");
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
  tekenCijferOverzicht();
  tekenAanvragen();
  if (typeof tekenFotoKeuring === "function") tekenFotoKeuring();   // 📸 fotos.js
}

// ---------- Aanvragen van bars (pagina voor-bars.html) ----------
const INTERESSE = { aanmelden: "Bar voorstellen", rit: "Bar + coffee ride", vraag: "Vraag", gratis: "Gratis vermelding", pakket: "Bar-pakket" };
const DAGKORT = { ma: "ma", di: "di", wo: "wo", do: "do", vr: "vr", za: "za", zo: "zo" };

// "ma–vr 08:00-17:00 · za 09:00-16:00 · zo gesloten"
function urenKort(uren) {
  if (!uren) return "";
  const dagen = Object.keys(DAGKORT);
  const groepen = [];
  for (const dag of dagen) {
    const waarde = uren[dag] || "gesloten";
    const laatste = groepen[groepen.length - 1];
    if (laatste && laatste.waarde === waarde) laatste.tot = dag;
    else groepen.push({ van: dag, tot: dag, waarde });
  }
  return groepen.map(g => (g.van === g.tot ? g.van : g.van + "–" + g.tot) + " " + g.waarde).join(" · ");
}

// Dezelfde naam (zonder hoofdletters en leestekens) en dezelfde gemeente of regio
function bestaandeBarVoor(a) {
  const sleutel = (tekst) => String(tekst || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
  const kandidaten = alleStops.filter(s => sleutel(s.naam) === sleutel(a.bar));
  return kandidaten.find(s => [s.plaats, s.stad, s.adres].some(x => sleutel(x).includes(sleutel(a.gemeente)))) || kandidaten[0] || null;
}

// Uren, tekst, kenmerken en foto van een aanvraag overnemen bij een bar die al op de kaart staat
async function werkBarBijUitAanvraag(stop, a, knop) {
  const wat = ["openingsuren", "beschrijving", "cycling-/PC-friendly", a.instagram || a.website ? "Instagram/website" : "", a.foto ? "foto" : ""].filter(Boolean).join(", ");
  if (!confirm(`${stop.naam} bijwerken met de gegevens uit deze aanvraag (${wat})?`)) return;
  knop.disabled = true;
  try {
    const velden = {};
    if (a.openingsuren) velden.openingsuren = a.openingsuren;
    if (a.info) velden[a.taal === "fr" ? "info_fr" : "info"] = a.info;
    if (a.wieler && stop.type === "coffee") velden.type = "both";
    if (instagramNaam(a.instagram)) velden.instagram = instagramNaam(a.instagram);
    if (websiteLink(a.website)) velden.website = websiteLink(a.website);
    const kenmerken = new Set(kenmerkenVan(stop));
    if (a.laptop) kenmerken.add("laptop");
    velden.kenmerken = [...kenmerken];
    await werkStopBij(stop.id, velden);
    Object.assign(stop, velden);
    if (a.foto) {
      const blob = await haalAanvraagFotoOp(a.foto);
      const url = await uploadFoto(blob, stop.id);
      await zetFotoVanStop(stop.id, url);
      stop.foto = url;
    }
    knop.textContent = "✓ Bijgewerkt";
    teken();
  } catch (fout) {
    knop.disabled = false;
    alert("Bijwerken lukte niet: " + fout.message);
  }
}

async function tekenAanvragen() {
  const vak = document.getElementById("aanvragenLijst");
  vak.textContent = "Laden…";
  let lijst;
  try { lijst = await haalBarAanvragenOp(); }
  catch (fout) { vak.textContent = "Niet geladen. Voerde je bar-aanvragen.sql al uit? (" + fout.message + ")"; return; }
  if (!lijst.length) { vak.innerHTML = `<p class="uitleg">Nog geen aanvragen.</p>`; return; }
  vak.innerHTML = "";
  for (const a of lijst) {
    const div = document.createElement("div");
    div.className = "aanvraag";
    const datum = new Date(a.gemaakt).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
    div.innerHTML = `<div class="kop"><b></b><span class="pil"></span></div>
      <img class="aanvraagFoto" alt="" hidden>
      <small class="adres"></small>
      <p class="info"></p>
      <small class="urenKort"></small>
      <small class="kenmerkRij"></small>
      <small class="links"></small>
      <small class="wie"></small>
      <p class="tekst"></p>
      <div class="knoppen">
        <button type="button" class="opKaart">➕ Op de kaart zetten</button>
        <button type="button" class="bijwerken" hidden></button>
        <a class="mail">✉️ Mailen</a>
        <button type="button" class="klaar">✓ Afgehandeld</button>
      </div>`;
    const zet = (sel, tekst) => { const el = div.querySelector(sel); el.textContent = tekst || ""; el.hidden = !tekst; };
    zet("b", a.bar + " · " + a.gemeente);
    zet(".pil", INTERESSE[a.interesse] || a.interesse);
    zet(".adres", a.straat ? "📍 " + a.straat + ", " + [a.postcode, a.gemeente].filter(Boolean).join(" ") + " (" + (a.landcode || "BE") + ")" : "");
    zet(".info", a.info);
    zet(".urenKort", a.openingsuren ? "🕐 " + urenKort(a.openingsuren) : "");
    zet(".kenmerkRij", [a.wieler ? "🚴 Cycling-friendly" : "", a.laptop ? "💻 PC-friendly" : ""].filter(Boolean).join(" · "));
    zet(".links", [a.instagram, a.website].filter(Boolean).join(" · "));
    zet(".wie", [a.naam, a.email, a.telefoon, datum, (a.taal || "nl").toUpperCase()].filter(Boolean).join(" · "));
    zet(".tekst", a.bericht);

    // De foto (tijdelijke link, want de map is niet openbaar)
    if (a.foto) {
      aanvraagFotoLink(a.foto).then(url => {
        const img = div.querySelector(".aanvraagFoto");
        img.src = url;
        img.hidden = false;
      }).catch(fout => console.warn("Foto niet geladen:", fout.message));
    }

    // Staat deze bar al op de kaart? Dan de gegevens bijwerken in plaats van een nieuwe bar
    const bestaand = bestaandeBarVoor(a);
    const bijwerken = div.querySelector(".bijwerken");
    if (bestaand) {
      bijwerken.hidden = false;
      bijwerken.textContent = "✏️ " + bestaand.naam + " bijwerken";
      bijwerken.onclick = () => werkBarBijUitAanvraag(bestaand, a, bijwerken);
    }

    // Oude aanvragen (zonder adres) kunnen niet rechtstreeks op de kaart
    const opKaart = div.querySelector(".opKaart");
    opKaart.hidden = !a.straat || Boolean(bestaand);
    opKaart.onclick = () => {
      document.getElementById("cijfersVenster").close();
      importeerAanvraag(a);
    };

    div.querySelector(".mail").href = "mailto:" + encodeURIComponent(a.email) +
      "?subject=" + encodeURIComponent("Waypour – " + a.bar);
    div.querySelector(".klaar").onclick = async () => {
      if (!confirm("Deze aanvraag wissen? (Bewaar eerst wat je nodig hebt.)")) return;
      try {
        if (a.foto) await verwijderAanvraagFoto(a.foto).catch(fout => console.warn(fout.message));
        await verwijderBarAanvraag(a.id);
        div.remove();
        if (!vak.children.length) vak.innerHTML = `<p class="uitleg">Nog geen aanvragen.</p>`;
      } catch (fout) { alert("Wissen lukte niet: " + fout.message); }
    };
    vak.appendChild(div);
  }
}

document.getElementById("cijfersKnop").onclick = openCijfers;
document.getElementById("cijfersSluiten").onclick = () => document.getElementById("cijfersVenster").close();
document.querySelectorAll("#cijfersPeriode button").forEach(knop => {
  knop.onclick = () => { cijferPeriode = knop.dataset.periode; tekenCijferOverzicht(); };
});

// Als CSV downloaden (opent in Excel of Numbers)
document.getElementById("cijfersCsv").onclick = () => {
  const veld = (tekst) => '"' + String(tekst).replace(/"/g, '""') + '"';
  const { sinds, tot } = periodeGrenzen(cijferPeriode);
  const regels = [["Bar", ...CIJFER_SOORTEN.map(s => s.kort)].map(veld).join(";")]
    .concat(cijferRijen.map(r => [r.stop.naam, ...CIJFER_SOORTEN.map(s => r.c[s.sleutel] || 0)].map(veld).join(";")));
  const blob = new Blob(["﻿" + regels.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `waypour-cijfers-${sinds}${tot ? "-tot-" + tot : ""}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

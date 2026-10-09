// =====================================================
//  WAYPOUR – vrienden en samen rijden
// =====================================================
// * Je vriendenlink (…/?vriend=CODE): wie erop klikt en inlogt, wordt je vriend.
// * Een rit-uitnodiging: een bar of route + dag/uur + bericht, naar één of meer vrienden.
// * Vrienden antwoorden "Ik doe mee" of "Kan niet". Nieuwe uitnodigingen: rood bolletje.

let mijnVrienden = [];   // [{ id, voornaam, foto }]
let mijnRitten = [];     // ritten met hun genodigden
let mijnVriendcode = null;
let mijnVerzoeken = [];       // [{ id, voornaam, foto, gebruikersnaam, richting: "in" | "uit" }]
let mijnGebruikersnaam = null;
let uitnodigingVoor = null;   // { stop } of { route } in het venster "Vrienden uitnodigen"

// ---------- Komt iemand binnen via een vriendenlink of een mail over een rit? ----------
(function leesLinkUitAdres() {
  const p = new URLSearchParams(location.search);
  const code = p.get("vriend");
  const rit = p.get("rit");
  try {
    if (code) localStorage.setItem("vriendWachtend", code);
    if (rit) localStorage.setItem("ritOpenen", rit);
  } catch {}
  if (code || rit) {
    p.delete("vriend");
    p.delete("rit");
    const rest = p.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
})();

function lokaal(sleutel) {
  try { return localStorage.getItem(sleutel); } catch { return null; }
}
function lokaalWeg(sleutel) {
  try { localStorage.removeItem(sleutel); } catch {}
}

// Een kort berichtje onderaan het scherm
function toonMelding(tekst) {
  let vak = document.getElementById("toast");
  if (!vak) {
    vak = document.createElement("div");
    vak.id = "toast";
    vak.setAttribute("role", "status");
    document.body.appendChild(vak);
  }
  vak.textContent = tekst;
  vak.hidden = false;
  clearTimeout(toonMelding.timer);
  toonMelding.timer = setTimeout(() => { vak.hidden = true; }, 4500);
}

// "zondag 12 oktober om 09:00"
function ritDatum(iso) {
  const locale = taal === "fr" ? "fr-BE" : taal === "en" ? "en-GB" : "nl-BE";
  return new Date(iso).toLocaleString(locale, {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
  });
}

// "🚴 Rit van 62 km" of "🚴 Mijn GPX · 62 km" (geen dubbele km)
function routeTitel(route) {
  const naam = route.naam || t("route");
  const km = route.km && !/\bkm\b/i.test(naam) ? " · " + Math.round(route.km) + " km" : "";
  return "🚴 " + naam + km;
}

// ---------- Na het inloggen en uitloggen (opgeroepen door app.js) ----------
async function vriendenNaInloggen() {
  const knop = document.getElementById("rittenKnop");
  if (!gebruiker) {
    mijnVrienden = [];
    mijnRitten = [];
    mijnVriendcode = null;
    mijnVerzoeken = [];
    mijnGebruikersnaam = null;
    naamGecontroleerd = false;
    const naamVenster = document.getElementById("kiesNaam");
    if (naamVenster && naamVenster.open) naamVenster.close();
    if (typeof chatNaInloggen === "function") chatNaInloggen();   // live verbinding stoppen
    knop.hidden = true;
    // Kwam je via een vriendenlink? Zeg dan dat je eerst moet inloggen.
    if (lokaal("vriendWachtend")) {
      const bericht = document.getElementById("loginBericht");
      if (bericht && !bericht.textContent) bericht.textContent = t("vriendNaLogin");
    }
    return;
  }
  knop.hidden = false;

  // Een vriendenlink die nog wachtte
  const code = lokaal("vriendWachtend");
  if (code) {
    lokaalWeg("vriendWachtend");
    try {
      const naam = await wordVriend(code);
      toonMelding(t("nuVrienden").replace("{naam}", naam || "?"));
    } catch (fout) {
      const tekst = String(fout.message || "");
      toonMelding(tekst.includes("eigen") ? t("eigenVriendenlink") : t("onbekendeVriendenlink"));
    }
  }

  // Je gebruikersnaam (om in het venster te tonen)
  try {
    const profiel = await haalProfielOp();
    mijnGebruikersnaam = profiel && profiel.gebruikersnaam ? profiel.gebruikersnaam : null;
    naamGecontroleerd = Boolean(profiel);   // alleen vragen als het profiel echt geladen is
  } catch (fout) { console.error(fout); }
  toonGebruikersnaam();
  vraagGebruikersnaamAlsNodig();

  await laadVrienden();
  await laadVerzoeken();
  await laadRitten();

  // Berichten en live meldingen (chat.js)
  if (typeof chatNaInloggen === "function") chatNaInloggen();

  // Kwam je binnen via de mail over een rit? Dan het venster meteen openen.
  if (lokaal("ritOpenen")) {
    lokaalWeg("ritOpenen");
    openRitten("ritten");
  }
}

async function laadVrienden() {
  try { mijnVrienden = await haalVriendenOp(); }
  catch (fout) { console.error(fout); mijnVrienden = []; }
  tekenVrienden();
}

async function laadRitten() {
  try {
    const grens = Date.now() - 12 * 60 * 60 * 1000;   // tot 12 uur na de start tonen we de rit nog
    mijnRitten = (await haalRittenOp())
      .filter(r => Date.parse(r.wanneer) > grens)
      .sort((x, y) => Date.parse(x.wanneer) - Date.parse(y.wanneer));
  } catch (fout) {
    console.error(fout);
    mijnRitten = [];
  }
  tekenTeller();
  tekenRitten();
}

// Het rode bolletje: uitnodigingen die je nog niet zag
function tekenTeller() {
  const teller = document.getElementById("rittenTeller");
  if (!teller || !gebruiker) return;
  const n = nieuwePerTab();
  const nieuw = n.ritten + n.berichten + n.vrienden;
  teller.textContent = nieuw;
  teller.hidden = nieuw === 0;
  // Ook een tellertje op elk tabblad
  document.querySelectorAll("#samenTabs button").forEach(k => {
    const t2 = k.querySelector(".teller");
    const aantal = n[k.dataset.tab] || 0;
    t2.textContent = aantal;
    t2.hidden = aantal === 0;
  });
}

// Even terugkomen naar de app (bv. na WhatsApp)? Dan opnieuw kijken
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && typeof gebruiker !== "undefined" && gebruiker) {
    laadVerzoeken();
    laadRitten();
  }
});

// ---------- Het venster "Samen rijden" ----------
// Hoeveel nieuwe dingen per tabblad?
function nieuwePerTab() {
  if (!gebruiker) return { ritten: 0, berichten: 0, vrienden: 0 };
  return {
    ritten: mijnRitten.filter(r => r.genodigden.some(g => g.gebruiker === gebruiker.id && !g.gezien)).length,
    berichten: typeof ongelezenBerichten === "function" ? ongelezenBerichten() : 0,
    vrienden: mijnVerzoeken.filter(v => v.richting === "in").length
  };
}

let huidigTab = "ritten";
function toonTabblad(tab) {
  huidigTab = tab;
  document.querySelectorAll("#samenTabs button").forEach(k => k.classList.toggle("actief", k.dataset.tab === tab));
  document.querySelectorAll("#ritten [data-tabblad]").forEach(s => { s.hidden = s.dataset.tabblad !== tab; });
  if (tab === "berichten" && typeof tekenGesprekken === "function") tekenGesprekken();
  // Wat je in het tabblad Ritten ziet, telt als gezien
  if (tab === "ritten" && mijnRitten.some(r => r.genodigden.some(g => g.gebruiker === gebruiker.id && !g.gezien))) {
    markeerRittenGezien().catch(console.error);
    for (const r of mijnRitten) for (const g of r.genodigden) if (g.gebruiker === gebruiker.id) g.gezien = true;
  }
  tekenTeller();
}
document.querySelectorAll("#samenTabs button").forEach(k => { k.onclick = () => toonTabblad(k.dataset.tab); });

function openRitten(tab) {
  const venster = document.getElementById("ritten");
  tekenRitten();
  tekenVrienden();
  tekenVerzoeken();
  toonGebruikersnaam();
  // Geen tabblad gekozen? Dan dat met iets nieuws (berichten, ritten, verzoeken), anders Ritten
  if (typeof tab !== "string") {
    const n = nieuwePerTab();
    tab = n.berichten ? "berichten" : n.ritten ? "ritten" : n.vrienden ? "vrienden" : "ritten";
  }
  if (!venster.open) {
    if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
  }
  toonTabblad(tab);
}
document.getElementById("rittenKnop").onclick = () => openRitten();
document.getElementById("rittenSluiten").onclick = () => document.getElementById("ritten").close();

function tekenRitten() {
  const lijst = document.getElementById("rittenLijst");
  if (!lijst || !gebruiker) return;
  lijst.innerHTML = "";
  if (!mijnRitten.length) {
    lijst.innerHTML = `<p class="uitleg">${esc(t("geenRitten"))}</p>`;
    return;
  }
  for (const rit of mijnRitten) {
    const ikMaak = rit.maker === gebruiker.id;
    const mij = rit.genodigden.find(g => g.gebruiker === gebruiker.id);
    const stop = rit.stop_id ? alleStops.find(s => s.id === rit.stop_id) : null;
    const wat = rit.route ? routeTitel(rit.route) : "☕ " + (stop ? stop.naam : t("barNietGevonden"));
    const symbool = { ja: "✅", nee: "❌", open: "⏳" };
    const wie = [`<span>👑 ${esc(ikMaak ? t("jij") : (rit.maker_naam || "?"))}</span>`]
      .concat(rit.genodigden.map(g =>
        `<span>${symbool[g.antwoord] || "⏳"} ${esc(g.gebruiker === gebruiker.id ? t("jij") : (g.naam || "?"))}</span>`))
      .join("");

    const li = document.createElement("article");
    li.className = "rit" + (mij && !mij.gezien ? " nieuw" : "");
    li.innerHTML = `
      <small class="ritWanneer"></small>
      <h4></h4>
      <p class="ritVan"></p>
      ${rit.bericht ? `<p class="ritBericht"></p>` : ""}
      <div class="ritWie">${wie}</div>
      <div class="acties">
        ${mij ? `<button type="button" class="ja ${mij.antwoord === "ja" ? "actief" : ""}">${esc(t("ikDoeMee"))}</button>
                 <button type="button" class="nee ${mij.antwoord === "nee" ? "actief" : ""}">${esc(t("kanNiet"))}</button>` : ""}
        ${rit.route ? `<button type="button" class="toon">${esc(t("toonRoute"))}</button>`
                    : stop ? `<button type="button" class="toon">${esc(t("toonBar"))}</button>` : ""}
        ${ikMaak ? `<button type="button" class="link wis">${esc(t("ritWissen"))}</button>` : ""}
      </div>`;
    li.querySelector(".ritWanneer").textContent = ritDatum(rit.wanneer);
    li.querySelector("h4").textContent = wat;
    li.querySelector(".ritVan").textContent = ikMaak ? t("jijOrganiseert") : t("vanNaam").replace("{naam}", rit.maker_naam || "?");
    if (rit.bericht) li.querySelector(".ritBericht").textContent = "“" + rit.bericht + "”";

    const antwoord = async (waarde) => {
      try {
        await beantwoordRit(rit.id, waarde);
        mij.antwoord = waarde;
        mij.gezien = true;
        tekenRitten();
        tekenTeller();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
    const ja = li.querySelector(".ja"), nee = li.querySelector(".nee");
    if (ja) ja.onclick = () => antwoord("ja");
    if (nee) nee.onclick = () => antwoord("nee");

    const toon = li.querySelector(".toon");
    if (toon) toon.onclick = () => {
      document.getElementById("ritten").close();
      if (rit.route) {
        if (typeof openBewaardeRoute === "function") {
          openBewaardeRoute({ ...rit.route, id: null, publiek: false });
        }
      } else if (stop) {
        gekozenLand = landVan(stop);
        gekozenStad = "alles";
        gekozenFilters = [];
        kies(stop.id);
      }
      document.getElementById("kaart").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const wis = li.querySelector(".wis");
    if (wis) wis.onclick = async () => {
      if (!confirm(t("zekerRitWissen"))) return;
      try {
        await verwijderRit(rit.id);
        mijnRitten = mijnRitten.filter(r => r.id !== rit.id);
        tekenRitten();
        tekenTeller();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
    lijst.appendChild(li);
  }
}

// ---------- Je gebruikersnaam ----------
function toonGebruikersnaam() {
  const veld = document.getElementById("gebruikersnaam");
  if (!veld) return;
  veld.value = mijnGebruikersnaam || "";
  document.getElementById("gebruikersnaamMelding").textContent = mijnGebruikersnaam ? "" : t("kiesGebruikersnaam");
}

document.getElementById("gebruikersnaamFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("gebruikersnaamMelding");
  const naam = document.getElementById("gebruikersnaam").value.trim().replace(/^@/, "").toLowerCase();
  try {
    const uitkomst = await zetGebruikersnaam(naam);
    if (uitkomst === "ok") {
      mijnGebruikersnaam = naam;
      document.getElementById("gebruikersnaam").value = naam;
      melding.textContent = t("gebruikersnaamBewaard").replace("{naam}", naam);
    } else {
      melding.textContent = t("gebruikersnaam_" + uitkomst).replace("{naam}", naam);
    }
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// ---------- Verplicht een gebruikersnaam kiezen ----------
// Iedereen zonder gebruikersnaam krijgt na het inloggen dit venster (ook bestaande accounts).
// Het verschijnt pas als de app zichtbaar is (dus na "profiel afmaken").
let naamGecontroleerd = false;   // pas vragen als we zeker weten dat er geen gebruikersnaam is

function voorstelGebruikersnaam() {
  let basis = (mijnVoornaam || (gebruiker && gebruiker.email ? gebruiker.email.split("@")[0] : "") || "fietser")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // é → e
    .toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 16);
  if (basis.length < 3) basis = (basis + "rider").slice(0, 16);
  return basis;
}

function vraagGebruikersnaamAlsNodig() {
  const venster = document.getElementById("kiesNaam");
  if (!venster || !gebruiker || !naamGecontroleerd || mijnGebruikersnaam) return;
  if (document.getElementById("app").hidden || venster.open) return;
  document.getElementById("kiesNaamVeld").value = voorstelGebruikersnaam();
  document.getElementById("kiesNaamMelding").textContent = t("gebruikersnaam_vorm");
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
}

// Niet wegklikken met Escape: kiezen is verplicht
document.getElementById("kiesNaam").addEventListener("cancel", (event) => event.preventDefault());

// Zodra de app zichtbaar wordt (bv. na "profiel afmaken"), opnieuw kijken
new MutationObserver(() => vraagGebruikersnaamAlsNodig())
  .observe(document.getElementById("app"), { attributes: true, attributeFilter: ["hidden"] });

document.getElementById("kiesNaamFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("kiesNaamMelding");
  const veld = document.getElementById("kiesNaamVeld");
  const naam = veld.value.trim().replace(/^@/, "").toLowerCase();
  const knop = event.target.querySelector("button[type=submit]");
  knop.disabled = true;
  try {
    const uitkomst = await zetGebruikersnaam(naam);
    if (uitkomst === "ok") {
      mijnGebruikersnaam = naam;
      toonGebruikersnaam();
      document.getElementById("kiesNaam").close();
      toonMelding(t("gebruikersnaamBewaard").replace("{naam}", naam));
    } else {
      melding.textContent = t("gebruikersnaam_" + uitkomst).replace("{naam}", naam);
      // Bezet? Stel meteen een variant voor
      if (uitkomst === "bezet" || uitkomst === "gereserveerd") {
        veld.value = (naam.slice(0, 16) + Math.floor(10 + Math.random() * 90)).slice(0, 20);
      }
    }
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
};

// ---------- Een vriend toevoegen op gebruikersnaam ----------
document.getElementById("vriendToevoegen").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("vriendMelding");
  const veld = document.getElementById("vriendNaam");
  const naam = veld.value.trim().replace(/^@/, "").toLowerCase();
  if (!naam) return;
  try {
    const uitkomst = await stuurVriendverzoek(naam);
    melding.textContent = t("verzoek_" + uitkomst).replace("{naam}", naam);
    if (uitkomst === "verstuurd" || uitkomst === "vrienden") veld.value = "";
    if (uitkomst === "vrienden") await laadVrienden();
    await laadVerzoeken();
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

async function laadVerzoeken() {
  try { mijnVerzoeken = await haalVriendverzoekenOp(); }
  catch (fout) { console.error(fout); mijnVerzoeken = []; }
  tekenVerzoeken();
  tekenTeller();
}

function tekenVerzoeken() {
  const blok = document.getElementById("verzoekenBlok");
  const lijst = document.getElementById("verzoekenLijst");
  if (!blok || !lijst) return;
  lijst.innerHTML = "";
  blok.hidden = mijnVerzoeken.length === 0;
  // Eerst wat binnenkwam, dan wat je zelf stuurde
  const gesorteerd = [...mijnVerzoeken].sort((x, y) => (x.richting === "in" ? 0 : 1) - (y.richting === "in" ? 0 : 1));
  for (const v of gesorteerd) {
    const li = document.createElement("li");
    li.className = v.richting === "in" ? "binnen" : "weg";
    li.innerHTML = `${avatarHTML(v)}
      <span class="naam"><b></b><small></small></span>
      ${v.richting === "in"
        ? `<button type="button" class="ja">${esc(t("aanvaarden"))}</button>
           <button type="button" class="link nee">${esc(t("weigeren"))}</button>`
        : `<button type="button" class="link nee">${esc(t("intrekken"))}</button>`}`;
    li.querySelector("b").textContent = v.voornaam || "?";
    li.querySelector("small").textContent = (v.gebruikersnaam ? "@" + v.gebruikersnaam + " · " : "") +
      (v.richting === "in" ? t("wilVriendWorden") : t("wachtOpAntwoord"));
    const ja = li.querySelector(".ja");
    if (ja) ja.onclick = async () => {
      try {
        await aanvaardVriendverzoek(v.id);
        toonMelding(t("nuVrienden").replace("{naam}", v.voornaam || "?"));
        await laadVrienden();
        await laadVerzoeken();
      } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    li.querySelector(".nee").onclick = async () => {
      try {
        await verwijderVriendverzoek(v.id, v.richting);
        await laadVerzoeken();
      } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    lijst.appendChild(li);
  }
}

// Een rondje met de profielfoto, of anders de eerste letter
function avatarHTML(v) {
  return `<span class="avatar">${v.foto ? `<img src="${esc(v.foto)}" alt="">` : esc((v.voornaam || "?").charAt(0).toUpperCase())}</span>`;
}

// ---------- Vrienden: je link delen en je lijst ----------
function tekenVrienden() {
  const lijst = document.getElementById("vriendenLijst");
  if (!lijst) return;
  lijst.innerHTML = "";
  if (!mijnVrienden.length) {
    lijst.innerHTML = `<li class="uitleg">${esc(t("geenVrienden"))}</li>`;
    return;
  }
  for (const v of mijnVrienden) {
    const li = document.createElement("li");
    li.innerHTML = `${avatarHTML(v)}
      <span class="naam"><b></b><small></small></span>
      <button type="button" class="chatKnop" aria-label="${esc(t("stuurBericht"))}">💬</button>
      <button type="button" class="link wegKnop">${esc(t("vriendWeg"))}</button>`;
    li.querySelector("b").textContent = v.voornaam || "?";
    li.querySelector("small").textContent = v.gebruikersnaam ? "@" + v.gebruikersnaam : "";
    li.querySelector(".chatKnop").onclick = () => { if (typeof openChat === "function") openChat(v); };
    li.querySelector(".wegKnop").onclick = async () => {
      if (!confirm(t("zekerVriendWeg").replace("{naam}", v.voornaam || "?"))) return;
      try {
        await verwijderVriend(v.id);
        mijnVrienden = mijnVrienden.filter(x => x.id !== v.id);
        tekenVrienden();
      } catch (fout) {
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
    lijst.appendChild(li);
  }
}

document.getElementById("deelVriendenlink").onclick = async () => {
  try {
    if (!mijnVriendcode) mijnVriendcode = await haalVriendcodeOp();
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
    return;
  }
  const link = location.origin + location.pathname + "?vriend=" + mijnVriendcode;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Waypour", text: t("vriendDeelTekst"), url: link });
      return;
    } catch (fout) {
      if (fout.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    toonMelding(t("linkGekopieerd"));
  } catch {
    prompt(t("kopieerLink"), link);
  }
};

// ---------- Vrienden uitnodigen voor een rit ----------
// Het knopje bij elke bar (app.js zet het in de lijst)
function uitnodigKnopHTML() {
  return `<button type="button" class="uitnodigKnop">${esc(t("ritPlannen"))}</button>`;
}

// Standaard: komende zondag om 9 uur
function volgendeZondag() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  const twee = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}T09:00`;
}

function openUitnodiging(wat) {
  if (!gebruiker) { alert(t("eerstInloggen")); return; }
  uitnodigingVoor = wat;
  const venster = document.getElementById("nodigUit");
  document.getElementById("nodigUitWat").textContent = wat.route ? routeTitel(wat.route) : "☕ " + wat.stop.naam;
  document.getElementById("nodigUitWanneer").value = volgendeZondag();
  document.getElementById("nodigUitBericht").value = "";
  document.getElementById("nodigUitMelding").textContent = "";

  const vak = document.getElementById("nodigUitVrienden");
  vak.innerHTML = "";
  if (!mijnVrienden.length) {
    vak.innerHTML = `<p class="uitleg">${esc(t("geenVrienden"))}</p>
      <button type="button" class="link" id="nodigUitDeel">${esc(t("deelVriendenlink"))}</button>`;
    vak.querySelector("#nodigUitDeel").onclick = () => document.getElementById("deelVriendenlink").click();
  }
  for (const v of mijnVrienden) {
    const label = document.createElement("label");
    label.className = "vinkje";
    label.innerHTML = `<input type="checkbox" value="${esc(v.id)}"> <span></span>`;
    label.querySelector("span").textContent = (v.voornaam || "?") + (v.gebruikersnaam ? " (@" + v.gebruikersnaam + ")" : "");
    vak.appendChild(label);
  }
  document.getElementById("nodigUitStuur").disabled = !mijnVrienden.length;
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
}
document.getElementById("nodigUitSluiten").onclick = () => document.getElementById("nodigUit").close();

document.getElementById("nodigUitFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("nodigUitMelding");
  const gekozen = [...document.querySelectorAll("#nodigUitVrienden input:checked")]
    .map(v => mijnVrienden.find(x => x.id === v.value)).filter(Boolean);
  if (!gekozen.length) { melding.textContent = t("kiesMinstensEen"); return; }
  const wanneer = document.getElementById("nodigUitWanneer").value;
  if (!wanneer) { melding.textContent = t("wanneer"); return; }

  const knop = document.getElementById("nodigUitStuur");
  knop.disabled = true;
  try {
    const rit = {
      maker_naam: (mijnVoornaam || "").slice(0, 40) || null,
      wanneer: new Date(wanneer).toISOString(),
      bericht: document.getElementById("nodigUitBericht").value.trim().slice(0, 200) || null,
      stop_id: uitnodigingVoor.stop ? uitnodigingVoor.stop.id : null,
      route: uitnodigingVoor.route || null
    };
    await maakRit(rit, gekozen);
    document.getElementById("nodigUit").close();
    toonMelding(t("uitnodigingVerstuurd"));
    laadRitten();
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
};

// De knop "👥 Uitnodigen" in het routepaneel
document.getElementById("routeUitnodigen").onclick = () => {
  if (!gebruiker) { alert(t("eerstInloggen")); return; }
  const route = typeof routeVoorUitnodiging === "function" ? routeVoorUitnodiging() : null;
  if (!route) { document.getElementById("routeMelding").textContent = t("eerstRoute"); return; }
  openUitnodiging({ route });
};

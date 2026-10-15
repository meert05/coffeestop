// =====================================================
//  WAYPOUR – groepen (zoals clubs op Strava)
// =====================================================
// * Tabblad "Groepen" in Samen rijden: je groepen, groepen zoeken, een groep maken.
// * Een groep: leden, groepsritten (meerijden aan/uit), uitnodigingslink, bewerken of verlaten.
// * Een uitnodigingslink ?groep=<code> toont eerst de groep; jij kiest of je lid wordt (zoals WhatsApp).
// * In een groep: tabbladen Ritten (ik rij mee / kan niet), Berichten, Routes en Leden.
// * Instelling "alleen beheerders": dan sturen alleen beheerders berichten, plannen ze ritten en
//   delen ze routes; de andere leden antwoorden alleen of ze meerijden.
// * In "Vrienden uitnodigen" (bar of route) kan je ook een groep kiezen: dan wordt het een groepsrit.
// * In het routepaneel: 📌 Naar groep, om een route in een groep te delen.

let mijnGroepen = [];        // [{ id, naam, beschrijving, regio, openbaar, code, rol, leden, volgende_rit }]
let openGroepId = null;      // de groep die je nu bekijkt
let groepLeden = [];
let groepRitten = [];
let groepBerichten = [];
let groepRoutes = [];
let groepBerichtRoutes = [];  // GPX-bestanden uit de berichten
let groepBijlage = null;      // het GPX-bestand dat je bij je volgende bericht stuurt
let groepTab = "ritten";
let groepUitnodiging = null;  // de groep uit een link, die nog op een antwoord wacht

// ---------- Komt iemand binnen via een groepslink? ----------
(function leesGroepslink() {
  const p = new URLSearchParams(location.search);
  const code = p.get("groep");
  if (!code) return;
  try { localStorage.setItem("groepWachtend", code); } catch {}
  p.delete("groep");
  const rest = p.toString();
  history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
})();

function groepslink(g) {
  return location.origin + location.pathname + "?groep=" + encodeURIComponent(g.code);
}

// Opgeroepen door vrienden.js na het inloggen (en het uitloggen)
async function groepenNaInloggen() {
  if (!gebruiker) {
    mijnGroepen = [];
    openGroepId = null;
    tekenNaarGroepKnop();
    if (lokaal("groepWachtend")) {
      const bericht = document.getElementById("loginBericht");
      if (bericht && !bericht.textContent) bericht.textContent = t("groepNaLogin");
    }
    return;
  }
  await laadGroepen();
  // Een groepslink die nog wachtte: eerst de groep tonen, jij kiest
  const code = lokaal("groepWachtend");
  if (code) {
    lokaalWeg("groepWachtend");
    await toonGroepUitnodiging(code);
  }
}

async function toonGroepUitnodiging(code) {
  let g;
  try { g = await groepVoorvertoning(code); }
  catch (fout) { console.error(fout); g = null; }
  if (!g) { toonMelding(t("onbekendeGroepslink")); return; }
  if (g.lid) { openGroep(g.id); return; }   // al lid: gewoon openen
  groepUitnodiging = { ...g, code };
  const venster = document.getElementById("groepUitnodiging");
  document.getElementById("gUitLogo").textContent = (g.naam || "?").trim().charAt(0).toUpperCase();
  document.getElementById("gUitNaam").textContent = g.naam;
  document.getElementById("gUitRegel").textContent = groepRegel(g);
  const beschr = document.getElementById("gUitBeschr");
  beschr.textContent = g.beschrijving || "";
  beschr.hidden = !g.beschrijving;
  document.getElementById("gUitJa").disabled = false;
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
}

document.getElementById("gUitNee").onclick = () => {
  groepUitnodiging = null;
  document.getElementById("groepUitnodiging").close();
};
document.getElementById("gUitJa").onclick = async () => {
  const g = groepUitnodiging;
  if (!g) return;
  const knop = document.getElementById("gUitJa");
  knop.disabled = true;
  try {
    const id = await wordGroepslidMetCode(g.code);
    document.getElementById("groepUitnodiging").close();
    groepUitnodiging = null;
    await laadGroepen();
    if (!id || !mijnGroepen.some(x => x.id === id)) { toonMelding(t("onbekendeGroepslink")); return; }
    toonMelding(t("nuGroepslid").replace("{naam}", g.naam));
    openGroep(id);
  } catch (fout) {
    knop.disabled = false;
    alert(String(fout.message || "").includes("vol") ? t("groepNietGelukt_vol") : t("opslaanMislukt") + " " + fout.message);
  }
};

async function laadGroepen() {
  try { mijnGroepen = await haalMijnGroepenOp(); }
  catch (fout) { console.error(fout); mijnGroepen = []; }
  tekenGroepen();
}

// ---------- Het overzicht ----------
function groepRegel(g) {
  const delen = [];
  if (g.regio) delen.push(g.regio);
  delen.push((Number(g.leden) === 1 ? t("eenLid") : t("aantalLeden").replace("{n}", g.leden)));
  if (g.openbaar === false) delen.push("🔒 " + t("besloten"));
  return delen.join(" · ");
}

function tekenGroepen() {
  const lijst = document.getElementById("mijnGroepenLijst");
  if (!lijst) return;
  lijst.innerHTML = "";
  if (!mijnGroepen.length) {
    lijst.innerHTML = `<li class="uitleg">${esc(t("geenGroepen"))}</li>`;
  }
  for (const g of mijnGroepen) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="groepRij"><span class="groepLogo"></span><span class="naam"><b></b><small></small><small class="volgende"></small></span><span class="pijl">›</span></button>`;
    li.querySelector(".groepLogo").textContent = (g.naam || "?").trim().charAt(0).toUpperCase();
    li.querySelector("b").textContent = g.naam + (g.rol === "beheerder" ? " 👑" : "");
    li.querySelector("small").textContent = groepRegel(g);
    const volgende = li.querySelector(".volgende");
    volgende.textContent = g.volgende_rit ? "🚴 " + t("volgendeRit") + " " + ritDatum(g.volgende_rit) : "";
    volgende.hidden = !g.volgende_rit;
    li.querySelector("button").onclick = () => openGroep(g.id);
    lijst.appendChild(li);
  }
  if (openGroepId && !mijnGroepen.some(g => g.id === openGroepId)) sluitGroep();
  tekenNaarGroepKnop();
}

// Mag je in deze groep berichten sturen, ritten plannen en routes delen?
function magPostenIn(g) {
  return Boolean(g && (!g.alleen_beheerders || g.rol === "beheerder"));
}

// Groepen zoeken
document.getElementById("groepZoekFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const vak = document.getElementById("groepZoekResultaten");
  vak.innerHTML = `<li class="uitleg">${esc(t("zoeken"))}…</li>`;
  let resultaten;
  try { resultaten = await zoekGroepen(document.getElementById("groepZoek").value.trim()); }
  catch (fout) { vak.innerHTML = `<li class="uitleg">${esc(t("opslaanMislukt") + " " + fout.message)}</li>`; return; }
  vak.innerHTML = "";
  if (!resultaten.length) vak.innerHTML = `<li class="uitleg">${esc(t("geenGroepGevonden"))}</li>`;
  for (const g of resultaten) {
    const li = document.createElement("li");
    li.innerHTML = `<div class="groepRij"><span class="groepLogo"></span><span class="naam"><b></b><small></small><small class="beschr"></small></span>
      <button type="button" class="lidKnop"></button></div>`;
    li.querySelector(".groepLogo").textContent = (g.naam || "?").trim().charAt(0).toUpperCase();
    li.querySelector("b").textContent = g.naam;
    li.querySelector("small").textContent = groepRegel(g);
    const beschr = li.querySelector(".beschr");
    beschr.textContent = g.beschrijving || "";
    beschr.hidden = !g.beschrijving;
    const knop = li.querySelector(".lidKnop");
    knop.textContent = g.lid ? t("openen") : t("lidWorden");
    knop.onclick = async () => {
      if (g.lid) { openGroep(g.id); return; }
      knop.disabled = true;
      try {
        const uitkomst = await wordGroepslid(g.id);
        if (uitkomst !== "ok") { toonMelding(t("groepNietGelukt_" + uitkomst) || t("opslaanMislukt")); knop.disabled = false; return; }
        await laadGroepen();
        document.getElementById("groepZoekResultaten").innerHTML = "";
        toonMelding(t("nuGroepslid").replace("{naam}", g.naam));
        openGroep(g.id);
      } catch (fout) {
        knop.disabled = false;
        alert(t("opslaanMislukt") + " " + fout.message);
      }
    };
    vak.appendChild(li);
  }
};

// Een groep maken
document.getElementById("groepMakenFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("groepMakenMelding");
  const naam = document.getElementById("groepNaam").value.trim();
  if (naam.length < 3) { melding.textContent = t("groepNaamTeKort"); return; }
  const knop = event.target.querySelector('button[type="submit"]');
  knop.disabled = true;
  try {
    const id = await maakGroep(naam, document.getElementById("groepBeschrijving").value.trim(),
                               document.getElementById("groepRegio").value.trim(),
                               document.getElementById("groepOpenbaar").checked);
    event.target.reset();
    document.getElementById("groepOpenbaar").checked = true;
    document.getElementById("groepMakenBlok").open = false;
    melding.textContent = "";
    await laadGroepen();
    openGroep(id);
    toonMelding(t("groepGemaakt"));
  } catch (fout) {
    melding.textContent = String(fout.message || "").includes("10 groepen") ? t("teVeelGroepen") : t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
};

// ---------- Eén groep ----------
async function openGroep(id) {
  openGroepId = id;
  // Het venster Samen rijden openen op het tabblad Groepen
  const venster = document.getElementById("ritten");
  if (!venster.open && typeof openRitten === "function") openRitten("groepen");
  else if (typeof toonTabblad === "function") toonTabblad("groepen");
  document.getElementById("groepenOverzicht").hidden = true;
  document.getElementById("groepDetail").hidden = false;
  document.getElementById("groepBewerken").hidden = true;
  tekenGroepKop();
  vulBarKeuze();
  document.getElementById("groepsritWanneer").value = typeof volgendeZondag === "function" ? volgendeZondag() : "";
  document.getElementById("groepRittenLijst").innerHTML = `<p class="uitleg">${esc(t("laden"))}</p>`;
  document.getElementById("groepLedenLijst").innerHTML = "";
  document.getElementById("groepRoutesLijst").innerHTML = "";
  document.getElementById("groepBerichten").innerHTML = "";
  groepBerichten = [];
  groepRoutes = [];
  groepBerichtRoutes = [];
  zetBijlage(null);
  toonGroepTab("ritten");
  pasPostenToe();
  await laadGroep();
}

function sluitGroep() {
  openGroepId = null;
  document.getElementById("groepenOverzicht").hidden = false;
  document.getElementById("groepDetail").hidden = true;
  tekenGroepen();
}
document.getElementById("groepTerug").onclick = sluitGroep;

async function laadGroep() {
  const id = openGroepId;
  if (!id) return;
  try {
    const [leden, ritten, routes, berichtRoutes] = await Promise.all([
      haalGroepLedenOp(id), haalGroepRittenOp(id),
      haalGroepRoutesOp(id).catch(fout => { console.error(fout); return []; }),
      haalGroepBerichtRoutesOp(id).catch(fout => { console.error(fout); return []; })
    ]);
    if (id !== openGroepId) return;   // intussen een andere groep geopend
    groepLeden = leden;
    groepRitten = ritten;
    groepRoutes = routes;
    groepBerichtRoutes = berichtRoutes;
  } catch (fout) {
    console.error(fout);
    groepLeden = [];
    groepRitten = [];
    groepRoutes = [];
    groepBerichtRoutes = [];
  }
  tekenGroepRitten();
  tekenGroepLeden();
  tekenGroepRoutes();
  if (groepTab === "berichten") laadGroepBerichten();
}

// ---------- Tabbladen in een groep ----------
function toonGroepTab(tab) {
  groepTab = tab;
  document.querySelectorAll("#groepTabs button").forEach(k => k.classList.toggle("actief", k.dataset.groeptab === tab));
  document.querySelectorAll("#groepDetail [data-groepvak]").forEach(v => { v.hidden = v.dataset.groepvak !== tab; });
  if (tab === "berichten") laadGroepBerichten();
}
document.querySelectorAll("#groepTabs button").forEach(k => { k.onclick = () => toonGroepTab(k.dataset.groeptab); });

// Wat je niet mag (bij "alleen beheerders"), zie je ook niet
function pasPostenToe() {
  const g = huidigeGroep();
  const mag = magPostenIn(g);
  document.querySelectorAll("#groepDetail .alleenPosters").forEach(el => { el.hidden = !mag; });
  document.getElementById("groepAlleenBeheerders").hidden = !(g && g.alleen_beheerders && !mag);
}

function huidigeGroep() {
  return mijnGroepen.find(g => g.id === openGroepId) || null;
}
function benBeheerder() {
  const g = huidigeGroep();
  return Boolean(g && g.rol === "beheerder");
}

function tekenGroepKop() {
  const g = huidigeGroep();
  const kop = document.getElementById("groepKop");
  const knoppen = document.getElementById("groepKnoppen");
  if (!g) { kop.innerHTML = ""; knoppen.innerHTML = ""; return; }
  kop.innerHTML = `<div class="groepTitel"><span class="groepLogo groot"></span><div><h2></h2><small></small></div></div><p class="groepBeschr"></p>`;
  kop.querySelector(".groepLogo").textContent = g.naam.trim().charAt(0).toUpperCase();
  kop.querySelector("h2").textContent = g.naam;
  kop.querySelector("small").textContent = groepRegel(g);
  const beschr = kop.querySelector(".groepBeschr");
  beschr.textContent = g.beschrijving || "";
  beschr.hidden = !g.beschrijving;

  knoppen.innerHTML = `
    <button type="button" class="deel">${esc(t("deelGroepslink"))}</button>
    ${g.rol === "beheerder" ? `<button type="button" class="bewerk">${esc(t("groepBewerken"))}</button>` : ""}
    <button type="button" class="link verlaat">${esc(t("groepVerlaten"))}</button>`;
  knoppen.querySelector(".deel").onclick = () => deelGroepslink(g);
  knoppen.querySelector(".verlaat").onclick = async () => {
    if (!confirm(t("zekerGroepVerlaten").replace("{naam}", g.naam))) return;
    try {
      await verlaatGroep(g.id);
      await laadGroepen();
      sluitGroep();
    } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
  };
  const bewerk = knoppen.querySelector(".bewerk");
  if (bewerk) bewerk.onclick = () => toonGroepBewerken(g);
  pasPostenToe();
}

async function deelGroepslink(g) {
  const link = groepslink(g);
  const tekst = t("groepUitnodigingTekst").replace("{naam}", g.naam);
  try {
    if (navigator.share) { await navigator.share({ title: g.naam, text: tekst, url: link }); return; }
  } catch (fout) { if (fout && fout.name === "AbortError") return; }
  try {
    await navigator.clipboard.writeText(tekst + " " + link);
    toonMelding(t("linkGekopieerd"));
  } catch {
    prompt(t("kopieerDezeLink"), link);
  }
}

// Bewerken (alleen de beheerder)
function toonGroepBewerken(g) {
  const vorm = document.getElementById("groepBewerken");
  vorm.hidden = !vorm.hidden;
  if (vorm.hidden) return;
  vorm.innerHTML = `
    <label class="veld"><span>${esc(t("groepNaam"))}</span><input class="bNaam" required minlength="3" maxlength="60"></label>
    <label class="veld"><span>${esc(t("groepRegio"))}</span><input class="bRegio" maxlength="60"></label>
    <label class="veld"><span>${esc(t("groepBeschrijving"))}</span><textarea class="bBeschr" maxlength="500" rows="2"></textarea></label>
    <label class="vinkje"><input class="bOpen" type="checkbox"> <span>${esc(t("groepOpenbaar"))}</span></label>
    <label class="vinkje"><input class="bAlleen" type="checkbox"> <span>${esc(t("alleenBeheerdersInstelling"))}</span></label>
    <small class="melding"></small>
    <div class="rij">
      <button type="submit">${esc(t("bewaren"))}</button>
      <button type="button" class="link wisGroep">${esc(t("groepVerwijderen"))}</button>
    </div>`;
  vorm.querySelector(".bNaam").value = g.naam;
  vorm.querySelector(".bRegio").value = g.regio || "";
  vorm.querySelector(".bBeschr").value = g.beschrijving || "";
  vorm.querySelector(".bOpen").checked = g.openbaar !== false;
  vorm.querySelector(".bAlleen").checked = Boolean(g.alleen_beheerders);
  vorm.onsubmit = async (event) => {
    event.preventDefault();
    const naam = vorm.querySelector(".bNaam").value.trim();
    if (naam.length < 3) { vorm.querySelector(".melding").textContent = t("groepNaamTeKort"); return; }
    try {
      await werkGroepBij(g.id, {
        naam,
        regio: vorm.querySelector(".bRegio").value.trim() || null,
        beschrijving: vorm.querySelector(".bBeschr").value.trim() || null,
        openbaar: vorm.querySelector(".bOpen").checked,
        alleen_beheerders: vorm.querySelector(".bAlleen").checked
      });
      await laadGroepen();
      vorm.hidden = true;
      tekenGroepKop();
    } catch (fout) { vorm.querySelector(".melding").textContent = t("opslaanMislukt") + " " + fout.message; }
  };
  vorm.querySelector(".wisGroep").onclick = async () => {
    if (!confirm(t("zekerGroepVerwijderen").replace("{naam}", g.naam))) return;
    try {
      await verwijderGroep(g.id);
      await laadGroepen();
      sluitGroep();
    } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
  };
}

// ---------- Groepsritten ----------
function tekenGroepRitten() {
  const lijst = document.getElementById("groepRittenLijst");
  lijst.innerHTML = "";
  if (!groepRitten.length) {
    lijst.innerHTML = `<p class="uitleg">${esc(t("geenGroepsritten"))}</p>`;
    return;
  }
  for (const rit of groepRitten) {
    const stop = rit.stop_id ? alleStops.find(s => s.id === rit.stop_id) : null;
    const wat = rit.route ? routeTitel(rit.route) : "☕ " + (stop ? stop.naam : t("barNietGevonden"));
    const mijnAntwoord = (rit.mee.find(m => m.gebruiker === gebruiker.id) || {}).antwoord || null;
    const ikMaak = rit.maker === gebruiker.id;
    const naamVan = m => m.gebruiker === gebruiker.id ? t("jij") : (m.naam || "?");
    const namen = rit.mee.filter(m => (m.antwoord || "ja") === "ja").map(naamVan);
    const nietMee = rit.mee.filter(m => m.antwoord === "nee").map(naamVan);

    const art = document.createElement("article");
    art.className = "rit";
    art.innerHTML = `
      <small class="ritWanneer"></small>
      <h4></h4>
      <p class="ritVan"></p>
      ${rit.bericht ? `<p class="ritBericht"></p>` : ""}
      <div class="ritWie"><span class="meeTekst"></span><span class="nietTekst"></span></div>
      <div class="acties">
        <button type="button" class="mee ${mijnAntwoord === "ja" ? "actief" : ""}">${esc("✓ " + t("ikRijMee"))}</button>
        <button type="button" class="niet ${mijnAntwoord === "nee" ? "actief" : ""}">${esc(t("kanNiet"))}</button>
        ${rit.route || stop ? `<button type="button" class="toon">${esc(rit.route ? t("toonRoute") : t("toonBar"))}</button>` : ""}
        ${ikMaak || benBeheerder() ? `<button type="button" class="link wis">${esc(t("ritWissen"))}</button>` : ""}
      </div>`;
    art.querySelector(".ritWanneer").textContent = ritDatum(rit.wanneer);
    art.querySelector("h4").textContent = wat;
    art.querySelector(".ritVan").textContent = ikMaak ? t("jijOrganiseert") : t("vanNaam").replace("{naam}", rit.maker_naam || "?");
    if (rit.bericht) art.querySelector(".ritBericht").textContent = "“" + rit.bericht + "”";
    art.querySelector(".meeTekst").textContent = namen.length
      ? "🚴 " + (namen.length === 1 ? t("eenRijdtMee") : t("aantalRijdenMee").replace("{n}", namen.length)) + ": " + namen.join(", ")
      : t("nogNiemandMee");
    const niet = art.querySelector(".nietTekst");
    niet.textContent = nietMee.length ? (nietMee.length === 1 ? t("eenKanNiet") : t("kunnenNiet").replace("{n}", nietMee.length)) + ": " + nietMee.join(", ") : "";
    niet.hidden = !nietMee.length;

    // Nog eens op je antwoord tikken = antwoord weghalen
    const antwoord = async (wat) => {
      try {
        await rijMeeMetGroep(rit.id, mijnVoornaam, mijnAntwoord === wat ? null : wat, Boolean(mijnAntwoord));
        await laadGroep();
      } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    art.querySelector(".mee").onclick = () => antwoord("ja");
    art.querySelector(".niet").onclick = () => antwoord("nee");
    const toon = art.querySelector(".toon");
    if (toon) toon.onclick = () => {
      document.getElementById("ritten").close();
      if (rit.route && typeof openBewaardeRoute === "function") {
        openBewaardeRoute({ ...rit.route, id: null, publiek: false });
      } else if (stop) {
        gekozenLand = landVan(stop);
        gekozenStad = "alles";
        gekozenFilters = [];
        kies(stop.id);
      }
    };
    const wis = art.querySelector(".wis");
    if (wis) wis.onclick = async () => {
      if (!confirm(t("zekerRitWissen"))) return;
      try { await verwijderGroepsrit(rit.id); await laadGroep(); await laadGroepen(); }
      catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    lijst.appendChild(art);
  }
}

// De bars om uit te kiezen bij een groepsrit (alfabetisch)
function vulBarKeuze() {
  const keuze = document.getElementById("groepsritBar");
  const bars = alleStops.filter(s => s.zichtbaar !== false).sort((a, b) => a.naam.localeCompare(b.naam));
  keuze.innerHTML = `<option value="">${esc(t("kiesEenBar"))}</option>` +
    bars.map(s => `<option value="${esc(s.id)}">${esc(s.naam)}${s.plaats ? " – " + esc(s.plaats) : ""}</option>`).join("");
}

document.getElementById("groepsritFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("groepsritMelding");
  const stopId = document.getElementById("groepsritBar").value;
  const wanneer = document.getElementById("groepsritWanneer").value;
  if (!stopId) { melding.textContent = t("kiesEenBar"); return; }
  if (!wanneer) { melding.textContent = t("wanneer"); return; }
  const knop = event.target.querySelector('button[type="submit"]');
  knop.disabled = true;
  try {
    await maakGroepsrit({
      groep: openGroepId,
      maker_naam: (mijnVoornaam || "").slice(0, 40) || null,
      wanneer: new Date(wanneer).toISOString(),
      bericht: document.getElementById("groepsritBericht").value.trim().slice(0, 200) || null,
      stop_id: stopId
    });
    if (typeof telBar === "function") telBar(stopId, "rit");   // anoniem tellen
    document.getElementById("groepsritBericht").value = "";
    document.getElementById("groepsritBlok").open = false;
    melding.textContent = "";
    toonMelding(t("groepsritGepland"));
    await laadGroep();
    await laadGroepen();
  } catch (fout) {
    melding.textContent = String(fout.message || "").includes("Te veel") ? t("teVeelGroepsritten") : t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
};

// ---------- Leden ----------
function tekenGroepLeden() {
  const lijst = document.getElementById("groepLedenLijst");
  lijst.innerHTML = "";
  const beheer = benBeheerder();
  for (const lid of groepLeden) {
    const li = document.createElement("li");
    li.innerHTML = `${vriendAvatarHTML(lid)}<span class="naam"><b></b><small></small></span>
      ${beheer && lid.id !== gebruiker.id ? `<button type="button" class="link wegKnop" aria-label="${esc(t("lidVerwijderen"))}">✕</button>` : ""}`;
    li.querySelector("b").textContent = (lid.id === gebruiker.id ? t("jij") : (lid.voornaam || "?")) + (lid.rol === "beheerder" ? " 👑" : "");
    li.querySelector("small").textContent = lid.gebruikersnaam ? "@" + lid.gebruikersnaam : "";
    const weg = li.querySelector(".wegKnop");
    if (weg) weg.onclick = async () => {
      if (!confirm(t("zekerLidVerwijderen").replace("{naam}", lid.voornaam || "?"))) return;
      try { await verlaatGroep(openGroepId, lid.id); await laadGroep(); await laadGroepen(); }
      catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    lijst.appendChild(li);
  }
}

// ---------- "Vrienden uitnodigen": ook een groep kunnen kiezen ----------
function vulGroepKeuze() {
  const blok = document.getElementById("nodigUitVoorBlok");
  const keuze = document.getElementById("nodigUitVoor");
  const groepen = mijnGroepen.filter(magPostenIn);
  blok.hidden = !groepen.length;
  keuze.innerHTML = `<option value="">${esc(t("mijnVrienden"))}</option>` +
    groepen.map(g => `<option value="${esc(g.id)}">👥 ${esc(g.naam)}</option>`).join("");
  keuze.value = openGroepId && groepen.some(g => g.id === openGroepId) ? openGroepId : "";
  keuze.onchange = tekenUitnodigVoor;
  tekenUitnodigVoor();
}
function tekenUitnodigVoor() {
  const voorGroep = Boolean(document.getElementById("nodigUitVoor").value);
  document.getElementById("nodigUitVriendenKop").hidden = voorGroep;
  document.getElementById("nodigUitVrienden").hidden = voorGroep;
  document.getElementById("nodigUitStuur").disabled = !voorGroep && !mijnVrienden.length;
  document.getElementById("nodigUitStuur").textContent = voorGroep ? t("groepsritKnop") : t("uitnodigingSturen");
}

// Opgeroepen door vrienden.js als in het venster een groep gekozen is
async function stuurGroepsrit(groepId, voor) {
  const melding = document.getElementById("nodigUitMelding");
  const wanneer = document.getElementById("nodigUitWanneer").value;
  if (!wanneer) { melding.textContent = t("wanneer"); return; }
  const knop = document.getElementById("nodigUitStuur");
  knop.disabled = true;
  try {
    await maakGroepsrit({
      groep: groepId,
      maker_naam: (mijnVoornaam || "").slice(0, 40) || null,
      wanneer: new Date(wanneer).toISOString(),
      bericht: document.getElementById("nodigUitBericht").value.trim().slice(0, 200) || null,
      stop_id: voor.stop ? voor.stop.id : null,
      route: voor.route || null
    });
    if (voor.stop && typeof telBar === "function") telBar(voor.stop.id, "rit");
    document.getElementById("nodigUit").close();
    toonMelding(t("groepsritGepland"));
    await laadGroepen();
  } catch (fout) {
    melding.textContent = String(fout.message || "").includes("Te veel") ? t("teVeelGroepsritten") : t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
}

// ---------- Berichten in de groep ----------
function korteTijd(iso) {
  const locale = taal === "fr" ? "fr-BE" : taal === "en" ? "en-GB" : "nl-BE";
  const d = new Date(iso);
  const vandaag = new Date().toDateString() === d.toDateString();
  return vandaag
    ? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function laadGroepBerichten() {
  const id = openGroepId;
  if (!id) return;
  let berichten;
  try { berichten = await haalGroepBerichtenOp(id); }
  catch (fout) { console.error(fout); return; }
  if (id !== openGroepId) return;
  const nieuw = berichten.length !== groepBerichten.length ||
    (berichten.length && berichten[berichten.length - 1].id !== groepBerichten[groepBerichten.length - 1].id);
  groepBerichten = berichten;
  if (nieuw || !document.getElementById("groepBerichten").children.length) tekenGroepBerichten();
}

function tekenGroepBerichten() {
  const vak = document.getElementById("groepBerichten");
  vak.innerHTML = "";
  if (!groepBerichten.length) {
    vak.innerHTML = `<p class="uitleg leeg">${esc(t("nogGeenGroepsberichten"))}</p>`;
    return;
  }
  const beheer = benBeheerder();
  for (const b of groepBerichten) {
    const mijn = b.van === gebruiker.id;
    const div = document.createElement("div");
    div.className = "bericht " + (mijn ? "mijn" : "hun");
    div.innerHTML = `${mijn ? "" : `<b class="van"></b>`}${b.route ? `<div class="berichtRoute"><span class="titel"></span><button type="button" class="toon">${esc(t("toonRoute"))}</button></div>` : ""}${b.tekst ? "<p></p>" : ""}<small><span class="tijd"></span>${mijn || beheer ? ` · <button type="button" class="link wis">${esc(t("wissen"))}</button>` : ""}</small>`;
    if (!mijn) div.querySelector(".van").textContent = b.naam || "?";
    if (b.tekst) div.querySelector("p").textContent = b.tekst;
    if (b.route) {
      div.querySelector(".berichtRoute .titel").textContent = routeKort(b.route);
      div.querySelector(".berichtRoute .toon").onclick = () => toonGroepsroute(b.route);
    }
    div.querySelector(".tijd").textContent = korteTijd(b.verzonden);
    const wis = div.querySelector(".wis");
    if (wis) wis.onclick = async () => {
      if (!confirm(t("zekerBerichtWissen"))) return;
      try { await verwijderGroepsbericht(b.id); await laadGroepBerichten(); if (b.route) laadGroep(); }
      catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    vak.appendChild(div);
  }
  vak.scrollTop = vak.scrollHeight;
}

document.getElementById("groepBerichtFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const vak = document.getElementById("groepBerichtTekst");
  const tekst = vak.value.trim().slice(0, 1000);
  if ((!tekst && !groepBijlage) || !openGroepId) return;
  const knop = event.target.querySelector('button[type="submit"]');
  knop.disabled = true;
  try {
    const metRoute = Boolean(groepBijlage);
    await stuurGroepsbericht(openGroepId, mijnVoornaam, tekst, groepBijlage);
    vak.value = "";
    vak.style.height = "";
    zetBijlage(null);
    await laadGroepBerichten();
    if (metRoute) laadGroep();   // ook in het tabblad Routes
  } catch (fout) {
    alert(String(fout.message || "").includes("Te veel") ? t("teVeelBerichten") : t("opslaanMislukt") + " " + fout.message);
  } finally {
    knop.disabled = false;
  }
};
// Enter = sturen, Shift+Enter = nieuwe regel; het vak groeit mee
document.getElementById("groepBerichtTekst").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    document.getElementById("groepBerichtFormulier").requestSubmit();
  }
});
document.getElementById("groepBerichtTekst").addEventListener("input", (event) => {
  const vak = event.target;
  vak.style.height = "";
  vak.style.height = Math.min(vak.scrollHeight, 140) + "px";
});

// Nieuwe berichten ophalen zolang je ze bekijkt (elke 15 seconden)
setInterval(() => {
  const venster = document.getElementById("ritten");
  if (openGroepId && groepTab === "berichten" && venster && venster.open && !document.hidden) laadGroepBerichten();
}, 15000);

// ---------- Routes in de groep ----------
function tekenGroepRoutes() {
  const lijst = document.getElementById("groepRoutesLijst");
  lijst.innerHTML = "";
  const beheer = benBeheerder();
  const items = [
    ...groepRoutes.map(r => ({ route: { ...r.route, naam: r.naam }, wie: r.door_naam, wanneer: r.gedeeld, eigen: r.door === gebruiker.id, id: r.id })),
    ...groepBerichtRoutes.map(b => ({ route: b.route, wie: b.naam, wanneer: b.verzonden, eigen: b.van === gebruiker.id, berichtId: b.id })),
    ...groepRitten.filter(r => r.route).map(r => ({ route: r.route, wie: r.maker_naam, rit: r }))
  ];
  if (!items.length) {
    lijst.innerHTML = `<p class="uitleg">${esc(t("nogGeenGroepsroutes"))}</p>`;
    return;
  }
  for (const item of items) {
    const art = document.createElement("article");
    art.className = "rit";
    art.innerHTML = `
      <h4></h4>
      <p class="ritVan"></p>
      <div class="acties">
        <button type="button" class="toon">${esc(t("toonRoute"))}</button>
        ${(item.id || item.berichtId) && (item.eigen || beheer) ? `<button type="button" class="link wis">${esc(t("wissen"))}</button>` : ""}
      </div>`;
    art.querySelector("h4").textContent = routeTitel(item.route) +
      (Number(item.route.hoogtemeters) ? " · ↗ " + Math.round(Number(item.route.hoogtemeters)) + " hm" : "");
    art.querySelector(".ritVan").textContent = item.rit
      ? t("routeVanGroepsrit").replace("{wanneer}", ritDatum(item.rit.wanneer))
      : t(item.berichtId ? "gestuurdDoor" : "gedeeldDoor").replace("{naam}", item.eigen ? t("jij") : (item.wie || "?")) + " · " + korteTijd(item.wanneer);
    art.querySelector(".toon").onclick = () => toonGroepsroute(item.route);
    const wis = art.querySelector(".wis");
    if (wis) wis.onclick = async () => {
      if (!confirm(t("zekerGroepsrouteWissen"))) return;
      try {
        if (item.berichtId) await verwijderGroepsbericht(item.berichtId); else await verwijderGroepsroute(item.id);
        await laadGroep();
      }
      catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
    lijst.appendChild(art);
  }
}

// ---------- 📌 Naar groep (in het routepaneel) ----------
function tekenNaarGroepKnop() {
  const knop = document.getElementById("routeNaarGroep");
  if (knop) knop.hidden = !(gebruiker && mijnGroepen.some(magPostenIn));
}

document.getElementById("routeNaarGroep").onclick = () => {
  const route = typeof routeVoorUitnodiging === "function" ? routeVoorUitnodiging() : null;
  if (!route) { document.getElementById("routeMelding").textContent = t("eerstRoute"); return; }
  const groepen = mijnGroepen.filter(magPostenIn);
  if (!groepen.length) return;
  const keuze = document.getElementById("naarGroepKeuze");
  keuze.innerHTML = groepen.map(g => `<option value="${esc(g.id)}">👥 ${esc(g.naam)}</option>`).join("");
  if (openGroepId && groepen.some(g => g.id === openGroepId)) keuze.value = openGroepId;
  document.getElementById("naarGroepNaam").value = (route.naam || t("routeStandaardNaam")).slice(0, 80);
  document.getElementById("naarGroepMelding").textContent = "";
  const venster = document.getElementById("naarGroepVenster");
  venster._route = route;
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
};
document.getElementById("naarGroepSluiten").onclick = () => document.getElementById("naarGroepVenster").close();
document.getElementById("naarGroepFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const venster = document.getElementById("naarGroepVenster");
  const groep = document.getElementById("naarGroepKeuze").value;
  const naam = document.getElementById("naarGroepNaam").value.trim();
  if (!groep || !naam || !venster._route) return;
  const knop = event.target.querySelector('button[type="submit"]');
  knop.disabled = true;
  try {
    await deelRouteInGroep(groep, naam, { ...venster._route, naam }, mijnVoornaam);
    venster.close();
    const g = mijnGroepen.find(x => x.id === groep);
    toonMelding(t("routeInGroepGedeeld").replace("{naam}", g ? g.naam : ""));
    if (openGroepId === groep) laadGroep();
  } catch (fout) {
    document.getElementById("naarGroepMelding").textContent = t("opslaanMislukt") + " " + fout.message;
  } finally {
    knop.disabled = false;
  }
};

// ---------- 📎 Een GPX-bestand bij je groepsbericht ----------
function routeKort(route) {
  return routeTitel(route) + (Number(route.hoogtemeters) ? " · ↗ " + Math.round(Number(route.hoogtemeters)) + " hm" : "");
}

function toonGroepsroute(route) {
  document.getElementById("ritten").close();
  if (typeof openBewaardeRoute === "function") openBewaardeRoute({ ...route, id: null, publiek: false });
}

// GPX → dezelfde vorm als een ingeladen route in het routepaneel
function gpxNaarRoute(tekst, bestandsnaam) {
  const { naam, spoor } = leesGpx(tekst, bestandsnaam);
  let km = 0, hoogtemeters = 0;
  for (let i = 1; i < spoor.length; i++) {
    km += afstandKm(spoor[i - 1], spoor[i]);
    const vorige = spoor[i - 1][2], nu = spoor[i][2];
    if (Number.isFinite(vorige) && Number.isFinite(nu) && nu > vorige) hoogtemeters += nu - vorige;
  }
  return {
    soort: "import", naam,
    punten: { naam, spoor, omwegen: [] },
    km: Number(km.toFixed(1)), hoogtemeters: Math.round(hoogtemeters)
  };
}

function zetBijlage(route) {
  groepBijlage = route;
  const vak = document.getElementById("groepBijlage");
  if (!vak) return;
  vak.hidden = !route;
  vak.innerHTML = "";
  if (!route) return;
  vak.innerHTML = `<span class="titel"></span><button type="button" class="link weg" aria-label="${esc(t("bijlageWeg"))}">✕</button>`;
  vak.querySelector(".titel").textContent = "📎 " + routeKort(route);
  vak.querySelector(".weg").onclick = () => zetBijlage(null);
}

document.getElementById("groepGpx").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";                         // zelfde bestand later opnieuw kunnen kiezen
  if (!bestand) return;
  if (bestand.size > 15 * 1024 * 1024) { alert(t("gpxTeGroot")); return; }
  try {
    zetBijlage(gpxNaarRoute(await bestand.text(), bestand.name));
    document.getElementById("groepBerichtTekst").focus();
  } catch (fout) {
    console.error(fout);
    alert(t("gpxFout"));
  }
};

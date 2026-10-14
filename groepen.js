// =====================================================
//  WAYPOUR – groepen (zoals clubs op Strava)
// =====================================================
// * Tabblad "Groepen" in Samen rijden: je groepen, groepen zoeken, een groep maken.
// * Een groep: leden, groepsritten (meerijden aan/uit), uitnodigingslink, bewerken of verlaten.
// * Een uitnodigingslink ?groep=<code> maakt je lid (ook van een besloten groep).
// * In "Vrienden uitnodigen" (bar of route) kan je ook een groep kiezen: dan wordt het een groepsrit.

let mijnGroepen = [];        // [{ id, naam, beschrijving, regio, openbaar, code, rol, leden, volgende_rit }]
let openGroepId = null;      // de groep die je nu bekijkt
let groepLeden = [];
let groepRitten = [];

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
    if (lokaal("groepWachtend")) {
      const bericht = document.getElementById("loginBericht");
      if (bericht && !bericht.textContent) bericht.textContent = t("groepNaLogin");
    }
    return;
  }
  // Een groepslink die nog wachtte
  const code = lokaal("groepWachtend");
  if (code) {
    lokaalWeg("groepWachtend");
    try {
      const id = await wordGroepslidMetCode(code);
      await laadGroepen();
      const groep = mijnGroepen.find(g => g.id === id);
      if (groep) {
        toonMelding(t("nuGroepslid").replace("{naam}", groep.naam));
        openGroep(groep.id);
        return;
      }
      toonMelding(t("onbekendeGroepslink"));
    } catch (fout) {
      console.error(fout);
      toonMelding(t("onbekendeGroepslink"));
    }
  }
  await laadGroepen();
}

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
    const [leden, ritten] = await Promise.all([haalGroepLedenOp(id), haalGroepRittenOp(id)]);
    if (id !== openGroepId) return;   // intussen een andere groep geopend
    groepLeden = leden;
    groepRitten = ritten;
  } catch (fout) {
    console.error(fout);
    groepLeden = [];
    groepRitten = [];
  }
  tekenGroepRitten();
  tekenGroepLeden();
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
    <small class="melding"></small>
    <div class="rij">
      <button type="submit">${esc(t("bewaren"))}</button>
      <button type="button" class="link wisGroep">${esc(t("groepVerwijderen"))}</button>
    </div>`;
  vorm.querySelector(".bNaam").value = g.naam;
  vorm.querySelector(".bRegio").value = g.regio || "";
  vorm.querySelector(".bBeschr").value = g.beschrijving || "";
  vorm.querySelector(".bOpen").checked = g.openbaar !== false;
  vorm.onsubmit = async (event) => {
    event.preventDefault();
    const naam = vorm.querySelector(".bNaam").value.trim();
    if (naam.length < 3) { vorm.querySelector(".melding").textContent = t("groepNaamTeKort"); return; }
    try {
      await werkGroepBij(g.id, {
        naam,
        regio: vorm.querySelector(".bRegio").value.trim() || null,
        beschrijving: vorm.querySelector(".bBeschr").value.trim() || null,
        openbaar: vorm.querySelector(".bOpen").checked
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
    const ikRijMee = rit.mee.some(m => m.gebruiker === gebruiker.id);
    const ikMaak = rit.maker === gebruiker.id;
    const namen = rit.mee.map(m => m.gebruiker === gebruiker.id ? t("jij") : (m.naam || "?"));

    const art = document.createElement("article");
    art.className = "rit";
    art.innerHTML = `
      <small class="ritWanneer"></small>
      <h4></h4>
      <p class="ritVan"></p>
      ${rit.bericht ? `<p class="ritBericht"></p>` : ""}
      <div class="ritWie"><span class="meeTekst"></span></div>
      <div class="acties">
        <button type="button" class="mee ${ikRijMee ? "actief" : ""}">${esc(ikRijMee ? "✓ " + t("ikRijMee") : t("ikRijMee"))}</button>
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

    art.querySelector(".mee").onclick = async () => {
      try {
        await rijMeeMetGroep(rit.id, mijnVoornaam, !ikRijMee);
        await laadGroep();
      } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
    };
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
  blok.hidden = !mijnGroepen.length;
  keuze.innerHTML = `<option value="">${esc(t("mijnVrienden"))}</option>` +
    mijnGroepen.map(g => `<option value="${esc(g.id)}">👥 ${esc(g.naam)}</option>`).join("");
  keuze.value = openGroepId && mijnGroepen.some(g => g.id === openGroepId) ? openGroepId : "";
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

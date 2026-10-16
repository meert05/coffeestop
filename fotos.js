// =====================================================
//  WAYPOUR – foto's van fietsers bij een koffiebar
// =====================================================
// * Bij een geopende bar: een strook "📸 Foto's van fietsers" (1 grote foto, of een mozaïek).
// * Tik op een foto: groot bekijken, vorige/volgende (ook vegen of pijltjestoetsen), melden, wissen.
// * "📸 Foto delen": kiezen, kleiner maken (dat wist ook de locatie uit de foto), zinnetje erbij, vinkje.
// * Een nieuwe foto wacht tot de beheerder hem goedkeurt (in 📊 Cijfers). Je eigen foto zie je meteen, met ⏳.

let barFotos = {};             // stopId → lijst foto's, of "laden"
let barFotosVoor = null;       // voor welke gebruiker de lijsten geladen zijn
let kijkerFotos = [];          // de foto's in de grote weergave
let kijkerIndex = 0;
let kijkerStop = null;
let fotoDelenStop = null;      // de bar waarvoor je een foto deelt
let fotoDelenGroot = null, fotoDelenKlein = null;

// ---------- De strook bij een bar (opgeroepen door app.js) ----------
function barFotosHTML(stop) {
  if (stop.id !== gekozenStop) return "";
  return `<div class="barFotos" data-stop="${esc(stop.id)}">${barFotosInhoud(stop)}</div>`;
}

function fotosVan(stop) {
  const ik = gebruiker ? gebruiker.id : null;
  if (barFotosVoor !== ik) { barFotos = {}; barFotosVoor = ik; }   // ingelogd of uitgelogd: opnieuw laden
  const lijst = barFotos[stop.id];
  if (lijst === undefined) laadBarFotos(stop);
  return Array.isArray(lijst) ? lijst : null;   // null = nog aan het laden
}

function barFotosInhoud(stop) {
  const fotos = fotosVan(stop);
  const kop = `<div class="barFotosKop"><span>📸 ${esc(t("fotosVanFietsers"))}</span>${fotos && fotos.length ? `<span class="aantal">${fotos.length}</span>` : ""}</div>`;
  if (fotos === null) return kop + `<div class="fotoMozaiek laden"><span></span><span></span><span></span></div>`;
  if (!fotos.length) {
    return kop + `<button type="button" class="fotoLeeg"><span class="groot">📸</span><span><b>${esc(t("wasJeHier"))}</b><small>${esc(t("deelEersteFoto"))}</small></span></button>`;
  }
  const getoond = fotos.slice(0, 3);
  const meer = fotos.length - getoond.length;
  const tegels = getoond.map((f, i) => `
    <button type="button" class="fotoTegel" data-i="${i}" aria-label="${esc(t("fotoBekijken"))}">
      <img src="${esc(bezoekfotoLink(f.pad, true))}" alt="" loading="lazy">
      ${f.status === "wacht" ? `<span class="wacht">⏳ ${esc(t("wachtOpGoedkeuring"))}</span>` : ""}
      ${i === getoond.length - 1 && meer > 0 ? `<span class="meer">+${meer}</span>` : ""}
    </button>`).join("");
  return kop + `<div class="fotoMozaiek aantal${getoond.length}">${tegels}</div>
    <button type="button" class="fotoToevoegen">📸 ${esc(t("fotoDelen"))}</button>`;
}

async function laadBarFotos(stop) {
  barFotos[stop.id] = "laden";
  let lijst = [];
  try { lijst = await haalBarFotosOp(stop.id); }
  catch (fout) { console.error(fout); }
  barFotos[stop.id] = lijst;
  hertekenBarFotos(stop);
}

function hertekenBarFotos(stop) {
  document.querySelectorAll(".barFotos").forEach(vak => {
    if (vak.dataset.stop !== stop.id) return;
    vak.innerHTML = barFotosInhoud(stop);
    koppelBarFotosVak(vak, stop);
  });
}

// De knoppen laten werken (opgeroepen door app.js na het tekenen van een bar)
function koppelBarFotos(li, stop) {
  const vak = li.querySelector(".barFotos");
  if (vak) koppelBarFotosVak(vak, stop);
}
function koppelBarFotosVak(vak, stop) {
  vak.onclick = (event) => {
    event.stopPropagation();          // de kaart niet laten verspringen
    const tegel = event.target.closest(".fotoTegel");
    if (tegel) { openFotoKijker(stop, Number(tegel.dataset.i)); return; }
    if (event.target.closest(".fotoToevoegen, .fotoLeeg")) kiesBezoekfoto(stop);
  };
}

// ---------- Groot bekijken ----------
const kijker = document.getElementById("fotoKijker");

function openFotoKijker(stop, index) {
  kijkerStop = stop;
  kijkerFotos = Array.isArray(barFotos[stop.id]) ? barFotos[stop.id] : [];
  if (!kijkerFotos.length) return;
  kijkerIndex = Math.max(0, Math.min(index, kijkerFotos.length - 1));
  tekenFotoKijker();
  if (!kijker.open) { if (kijker.showModal) kijker.showModal(); else kijker.setAttribute("open", ""); }
}

function tekenFotoKijker() {
  const f = kijkerFotos[kijkerIndex];
  if (!f) { kijker.close(); return; }
  const beeld = document.getElementById("kijkerBeeld");
  beeld.src = bezoekfotoLink(f.pad);
  beeld.alt = f.tekst || t("fotosVanFietsers");
  document.getElementById("kijkerTeller").textContent = (kijkerIndex + 1) + " / " + kijkerFotos.length;
  document.getElementById("kijkerBar").textContent = kijkerStop ? kijkerStop.naam : "";
  const tekst = document.getElementById("kijkerTekst");
  tekst.textContent = f.tekst ? "“" + f.tekst + "”" : "";
  tekst.hidden = !f.tekst;
  const locale = taal === "fr" ? "fr-BE" : taal === "en" ? "en-GB" : "nl-BE";
  const eigen = gebruiker && f.door === gebruiker.id;
  document.getElementById("kijkerWie").textContent =
    (eigen ? t("jij") : (f.door_naam || t("anoniem"))) + " · " +
    new Date(f.gemaakt).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) +
    (f.status === "wacht" ? " · ⏳ " + t("wachtOpGoedkeuring") : "");
  document.getElementById("kijkerVorige").hidden = kijkerIndex === 0;
  document.getElementById("kijkerVolgende").hidden = kijkerIndex >= kijkerFotos.length - 1;
  const meld = document.getElementById("kijkerMeld");
  meld.hidden = !gebruiker || eigen || f.status !== "goed";
  meld.disabled = false;
  meld.textContent = "🚩 " + t("fotoMelden");
  document.getElementById("kijkerWis").hidden = !(eigen || (typeof isBeheerder === "function" && isBeheerder()));
}

function bladerKijker(stap) {
  const nieuw = kijkerIndex + stap;
  if (nieuw < 0 || nieuw >= kijkerFotos.length) return;
  kijkerIndex = nieuw;
  tekenFotoKijker();
}
document.getElementById("kijkerVorige").onclick = () => bladerKijker(-1);
document.getElementById("kijkerVolgende").onclick = () => bladerKijker(1);
document.getElementById("kijkerSluiten").onclick = () => kijker.close();
kijker.addEventListener("click", (event) => { if (event.target === kijker) kijker.close(); });   // naast de foto tikken
kijker.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") bladerKijker(-1);
  if (event.key === "ArrowRight") bladerKijker(1);
});
// Vegen op de gsm
let vegenVan = null;
document.getElementById("kijkerVak").addEventListener("pointerdown", (event) => { vegenVan = event.clientX; });
document.getElementById("kijkerVak").addEventListener("pointerup", (event) => {
  if (vegenVan === null) return;
  const dx = event.clientX - vegenVan;
  vegenVan = null;
  if (Math.abs(dx) > 45) bladerKijker(dx < 0 ? 1 : -1);
});

document.getElementById("kijkerMeld").onclick = async () => {
  const f = kijkerFotos[kijkerIndex];
  if (!f || !confirm(t("zekerFotoMelden"))) return;
  const knop = document.getElementById("kijkerMeld");
  knop.disabled = true;
  try {
    await meldBezoekfoto(f.id);
    knop.textContent = "✓ " + t("fotoGemeld");
  } catch (fout) {
    knop.disabled = false;
    alert(t("opslaanMislukt") + " " + fout.message);
  }
};
document.getElementById("kijkerWis").onclick = async () => {
  const f = kijkerFotos[kijkerIndex];
  if (!f || !confirm(t("zekerFotoWissen"))) return;
  try {
    await verwijderBezoekfoto(f);
    barFotos[f.stop_id] = (barFotos[f.stop_id] || []).filter(x => x.id !== f.id);
    kijkerFotos = barFotos[f.stop_id];
    if (kijkerIndex >= kijkerFotos.length) kijkerIndex = kijkerFotos.length - 1;
    if (kijkerStop) hertekenBarFotos(kijkerStop);
    if (kijkerFotos.length) tekenFotoKijker(); else kijker.close();
  } catch (fout) { alert(t("opslaanMislukt") + " " + fout.message); }
};

// ---------- Een foto delen ----------
// De foto opnieuw tekenen = kleiner maken én alle extra gegevens (zoals de GPS-locatie) weglaten
async function maakFotoKlaar(bestand, maximum, kwaliteit) {
  const beeld = await createImageBitmap(bestand, { imageOrientation: "from-image" });
  const schaal = Math.min(1, maximum / Math.max(beeld.width, beeld.height));
  const doek = document.createElement("canvas");
  doek.width = Math.round(beeld.width * schaal);
  doek.height = Math.round(beeld.height * schaal);
  doek.getContext("2d").drawImage(beeld, 0, 0, doek.width, doek.height);
  if (beeld.close) beeld.close();
  return new Promise((klaar, mislukt) =>
    doek.toBlob(blob => blob ? klaar(blob) : mislukt(new Error("geen foto")), "image/jpeg", kwaliteit));
}

function kiesBezoekfoto(stop) {
  if (!gebruiker) { alert(t("eerstInloggenFoto")); return; }
  fotoDelenStop = stop;
  document.getElementById("bezoekfotoKiezer").click();
}

const fotoDelenVenster = document.getElementById("fotoDelen");
document.getElementById("bezoekfotoKiezer").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";                         // zelfde foto later opnieuw kunnen kiezen
  if (!bestand || !fotoDelenStop) return;
  try {
    fotoDelenGroot = await maakFotoKlaar(bestand, 1600, 0.85);
    fotoDelenKlein = await maakFotoKlaar(bestand, 640, 0.8);
  } catch (fout) {
    console.error(fout);
    alert(t("fotoNietGelezen"));
    return;
  }
  const voorbeeld = document.getElementById("fotoDelenVoorbeeld");
  if (voorbeeld.dataset.url) URL.revokeObjectURL(voorbeeld.dataset.url);
  voorbeeld.dataset.url = URL.createObjectURL(fotoDelenGroot);
  voorbeeld.src = voorbeeld.dataset.url;
  document.getElementById("fotoDelenBar").textContent = fotoDelenStop.naam;
  document.getElementById("fotoDelenTekst").value = "";
  document.getElementById("fotoDelenToestemming").checked = false;
  document.getElementById("fotoDelenMelding").textContent = "";
  if (fotoDelenVenster.showModal) fotoDelenVenster.showModal(); else fotoDelenVenster.setAttribute("open", "");
};
document.getElementById("fotoDelenSluiten").onclick = () => fotoDelenVenster.close();
document.getElementById("fotoDelenAnders").onclick = () => document.getElementById("bezoekfotoKiezer").click();

document.getElementById("fotoDelenFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("fotoDelenMelding");
  if (!document.getElementById("fotoDelenToestemming").checked) { melding.textContent = t("vinkToestemming"); return; }
  if (!fotoDelenGroot || !fotoDelenStop) return;
  const knop = event.target.querySelector('button[type="submit"]');
  knop.disabled = true;
  melding.textContent = t("fotoUploaden");
  const stop = fotoDelenStop;
  try {
    await deelBezoekfoto(stop.id, fotoDelenGroot, fotoDelenKlein,
                         document.getElementById("fotoDelenTekst").value.trim(), mijnVoornaam);
    fotoDelenVenster.close();
    toonMelding(t("fotoBedankt"));
    await laadBarFotos(stop);
  } catch (fout) {
    const tekst = String(fout.message || "");
    melding.textContent = tekst.includes("bij deze bar") ? t("teVeelFotosBar")
      : tekst.includes("vandaag") ? t("teVeelFotosDag")
      : t("opslaanMislukt") + " " + tekst;
  } finally {
    knop.disabled = false;
  }
};

// ---------- Beheerder: goedkeuren en meldingen (in 📊 Cijfers) ----------
function barNaam(stopId) {
  const s = alleStops.find(x => x.id === stopId);
  return s ? s.naam : stopId;
}

async function tekenFotoKeuring() {
  const vak = document.getElementById("fotoKeuring");
  if (!vak) return;
  vak.textContent = "Laden…";
  let data;
  try { data = await haalTeKeurenFotosOp(); }
  catch (fout) { vak.textContent = "Niet geladen. Voerde je bezoekfotos.sql al uit? (" + fout.message + ")"; return; }
  zetKeuringTeller(data.wacht.length);
  vak.innerHTML = "";
  if (!data.wacht.length && !data.gemeld.length) {
    vak.innerHTML = `<p class="uitleg">Niets te doen: geen nieuwe of gemelde foto's.</p>`;
    return;
  }
  const kaart = (f, gemeld) => {
    const div = document.createElement("div");
    div.className = "keurFoto";
    div.innerHTML = `
      <a class="beeld" target="_blank" rel="noopener"><img alt="" loading="lazy"></a>
      <div class="info">
        <b class="bar"></b>
        <small class="wie"></small>
        <p class="tekst"></p>
        ${gemeld ? `<span class="label dicht">🚩 ${f.meldingen}× gemeld</span>` : ""}
        <div class="rij">
          ${gemeld ? `<button type="button" class="houd">Houden</button>` : `<button type="button" class="goed knopHoofd">✓ Goedkeuren</button>`}
          <button type="button" class="link weg">${gemeld ? "Wissen" : "✕ Weigeren"}</button>
        </div>
      </div>`;
    div.querySelector(".beeld").href = bezoekfotoLink(f.pad);
    div.querySelector("img").src = bezoekfotoLink(f.pad, true);
    div.querySelector(".bar").textContent = barNaam(f.stop_id);
    div.querySelector(".wie").textContent = (f.door_naam || "?") + " · " + new Date(f.gemaakt).toLocaleString("nl-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const tekst = div.querySelector(".tekst");
    tekst.textContent = f.tekst || "";
    tekst.hidden = !f.tekst;
    const klaar = () => { delete barFotos[f.stop_id]; div.remove(); if (!vak.children.length) tekenFotoKeuring(); };
    const goed = div.querySelector(".goed");
    if (goed) goed.onclick = async () => {
      goed.disabled = true;
      try { await keurBezoekfotoGoed(f.id); klaar(); zetKeuringTeller(Math.max(0, keuringTeller - 1)); }
      catch (fout) { goed.disabled = false; alert("Lukte niet: " + fout.message); }
    };
    const houd = div.querySelector(".houd");
    if (houd) houd.onclick = async () => {
      try { await wisMeldingenVanFoto(f.id); klaar(); }
      catch (fout) { alert("Lukte niet: " + fout.message); }
    };
    div.querySelector(".weg").onclick = async () => {
      if (!confirm(gemeld ? "Deze foto wissen?" : "Deze foto weigeren? Hij wordt gewist.")) return;
      try { await verwijderBezoekfoto(f); klaar(); if (!gemeld) zetKeuringTeller(Math.max(0, keuringTeller - 1)); }
      catch (fout) { alert("Lukte niet: " + fout.message); }
    };
    return div;
  };
  for (const f of data.wacht) vak.appendChild(kaart(f, false));
  for (const f of data.gemeld) vak.appendChild(kaart(f, true));
}

// "📊 Cijfers · 📸 3" als er foto's wachten
let keuringTeller = 0;
function zetKeuringTeller(n) {
  keuringTeller = n;
  const knop = document.getElementById("cijfersKnop");
  if (knop) knop.textContent = "📊 Cijfers" + (n ? " · 📸 " + n : "");
}
async function telTeKeurenFotos() {
  try { zetKeuringTeller((await haalTeKeurenFotosOp()).wacht.length); }
  catch (fout) { console.error(fout); }
}

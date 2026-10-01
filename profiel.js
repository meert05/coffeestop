// =====================================================
//  MIJN PROFIEL – gegevens, foto, voorkeuren en statistieken
// =====================================================

let mijnProfiel = null;              // de rij uit de tabel "profielen"
let voorkeurenToegepast = false;     // regio en filters maar één keer per bezoek instellen

// Welke fiets → welke routestijl en snelheid (voor de geschatte rijtijd)
const FIETSEN = {
  koersfiets: { stijl: "snel",       snelheid: 27 },
  gravel:     { stijl: "fietspaden", snelheid: 22 },
  stadsfiets: { stijl: "rustig",     snelheid: 16 },
  ebike:      { stijl: "fietspaden", snelheid: 23 }
};

const venster = document.getElementById("profiel");
const profielMelding = document.getElementById("profielMelding");

// ---------- Openen en sluiten ----------
document.getElementById("profielKnop").onclick = openProfiel;
document.getElementById("profielSluiten").onclick = () => venster.close();
// Klik naast het venster: sluiten
venster.addEventListener("click", (event) => { if (event.target === venster) venster.close(); });

function openProfiel() {
  if (!gebruiker) return;
  profielMelding.textContent = "";
  vulProfiel();
  if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
}

// ---------- Wordt opgeroepen door app.js nadat je profiel geladen is ----------
function profielGeladen(profiel) {
  mijnProfiel = profiel || {};
  mijnFoto = mijnProfiel.foto || null;
  toonAvatarKlein();
  // Nieuw account? Dan eerst het profiel afmaken, vóór de homepage
  if (!mijnProfiel.onboarding_klaar) {
    toonProfielStart();
    return;
  }
  pasVoorkeurenToe();
}

function toonAvatarKlein() {
  document.getElementById("avatarKlein").outerHTML =
    avatarHTML(mijnFoto, mijnVoornaam || (gebruiker && gebruiker.email), "").replace('class="avatar ', 'id="avatarKlein" class="avatar ');
}

// ---------- Het venster invullen ----------
function vulProfiel() {
  const p = mijnProfiel || {};

  // Kop: foto, naam, e-mail en lid sinds
  document.getElementById("avatarGroot").outerHTML =
    avatarHTML(mijnFoto, mijnVoornaam || gebruiker.email, "groot").replace('class="avatar ', 'id="avatarGroot" class="avatar ');
  document.getElementById("profielNaam").textContent = mijnVoornaam || t("geenNaam");
  const sinds = gebruiker.created_at
    ? new Date(gebruiker.created_at).toLocaleDateString(taal, { month: "long", year: "numeric" }) : "";
  document.getElementById("profielInfo").textContent = gebruiker.email + (sinds ? " · " + t("lidSinds") + " " + sinds : "");
  document.getElementById("profielFotoWeg").hidden = !mijnFoto;

  // Gegevens
  document.getElementById("profielVoornaam").value = mijnVoornaam;
  document.getElementById("profielTaal").value = taal;

  // Voorkeuren
  const gebruik = p.gebruik || [];
  document.querySelectorAll('input[name="profielGebruik"]').forEach(v => v.checked = gebruik.includes(v.value));
  vulRegioKeuze(p.favoriete_regio || "");
  document.getElementById("profielFiets").value = p.fiets || "";
  toonFietsKeuze("profielGebruik", "profielFietsLabel");

  tekenStatistieken();
}

// De keuzelijst met regio's, automatisch uit de bars
function vulRegioKeuze(gekozen, keuzeId = "profielRegio") {
  const keuze = document.getElementById(keuzeId);
  const groepen = [...new Set(alleStops.map(groepVan))]
    .sort((x, y) => groepNaam(x).localeCompare(groepNaam(y)));
  keuze.innerHTML = `<option value="">${t("geenKeuze")}</option>` +
    groepen.map(g => `<option value="${esc(g)}">${esc(groepNaam(g))}</option>`).join("");
  keuze.value = gekozen ? stadSleutel(gekozen) : "";
}

// ---------- Statistieken en badges ----------
function mijnCijfers() {
  const mijnReviews = alleReviews.filter(r => gebruiker && r.user_id === gebruiker.id);
  const routes = typeof mijnRoutes !== "undefined" ? mijnRoutes : [];
  const km = routes.reduce((som, r) => som + (Number(r.km) || 0), 0);
  const langste = routes.reduce((max, r) => Math.max(max, Number(r.km) || 0), 0);
  // In hoeveel verschillende regio's heb je een favoriet of review?
  const regios = new Set([...favorieten, ...mijnReviews.map(r => r.stop_id)]
    .map(id => alleStops.find(s => s.id === id)).filter(Boolean).map(groepVan));
  return { reviews: mijnReviews.length, favorieten: favorieten.length, routes: routes.length, km, langste, regios: regios.size };
}

const BADGES = [
  { id: "eersteReview", icoon: "☕", nodig: c => c.reviews >= 1 },
  { id: "recensent",    icoon: "⭐", nodig: c => c.reviews >= 5 },
  { id: "verzamelaar",  icoon: "★",  nodig: c => c.favorieten >= 10 },
  { id: "planner",      icoon: "🗺️", nodig: c => c.routes >= 1 },
  { id: "centurion",    icoon: "🚴", nodig: c => c.langste >= 100 },
  { id: "ontdekker",    icoon: "🌍", nodig: c => c.regios >= 3 }
];

function tekenStatistieken() {
  const c = mijnCijfers();
  const tegel = (getal, label) => `<div class="tegel"><b>${getal}</b><span>${label}</span></div>`;
  document.getElementById("profielStats").innerHTML =
    tegel(c.favorieten, t("statFavorieten")) +
    tegel(c.reviews, t("statReviews")) +
    tegel(c.routes, t("statRoutes")) +
    tegel(Math.round(c.km).toLocaleString(taal), t("statKm"));

  document.getElementById("profielBadges").innerHTML = BADGES.map(b => {
    const behaald = b.nodig(c);
    return `<span class="badge ${behaald ? "behaald" : ""}" title="${esc(t("badgeUitleg_" + b.id))}">
      <i>${b.icoon}</i> ${esc(t("badge_" + b.id))}</span>`;
  }).join("");
}

// ---------- Gegevens bewaren ----------
document.getElementById("gegevensFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const voornaam = document.getElementById("profielVoornaam").value.trim().slice(0, 40);
  const nieuweTaal = document.getElementById("profielTaal").value;
  try {
    await bewaarProfiel({ voornaam: voornaam, taal: nieuweTaal });
    if (voornaam !== mijnVoornaam) {
      mijnVoornaam = voornaam;
      mijnProfiel.voornaam = voornaam;
      // Ook je naam bij je reviews aanpassen
      await werkMijnReviewsBij({ voornaam: voornaam });
      alleReviews.forEach(r => { if (r.user_id === gebruiker.id) r.voornaam = voornaam; });
      document.getElementById("wie").textContent = voornaam || gebruiker.email;
      toonAvatarKlein();
    }
    if (nieuweTaal !== taal) zetTaal(nieuweTaal);
    vulProfiel();
    profielMelding.textContent = t("profielBewaard");
    teken();
  } catch (fout) {
    profielMelding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// ---------- Voorkeuren bewaren ----------
document.getElementById("voorkeurenFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const gebruik = [...document.querySelectorAll('input[name="profielGebruik"]:checked')].map(v => v.value);
  const velden = {
    gebruik: gebruik,
    favoriete_regio: document.getElementById("profielRegio").value || null,
    // Je fiets telt alleen als je Waypour gebruikt om te koersen
    fiets: gebruik.includes("koersen") ? (document.getElementById("profielFiets").value || null) : null
  };
  try {
    await bewaarProfiel(velden);
    Object.assign(mijnProfiel, velden);
    pasFietsToe();
    profielMelding.textContent = t("profielBewaard");
  } catch (fout) {
    profielMelding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// Je fiets en snelheid gebruiken voor de routeplanner
function pasFietsToe() {
  const fiets = FIETSEN[mijnProfiel && mijnProfiel.fiets];
  if (typeof routeSnelheid !== "undefined") {
    routeSnelheid = (fiets && fiets.snelheid) || 25;
  }
  if (fiets && typeof routeStijl !== "undefined") {
    routeStijl = fiets.stijl;
    if (typeof tekenStijlKnoppen === "function" && routeModus) tekenStijlKnoppen();
  }
  if (typeof tekenRoutePaneel === "function") tekenRoutePaneel();
}

// Bij het openen van de app: je favoriete regio tonen en de filters afstemmen op je gebruik
function pasVoorkeurenToe(poging = 0) {
  pasFietsToe();
  if (voorkeurenToegepast || !mijnProfiel) return;
  if (alleStops.length === 0) {                   // de bars zijn nog niet geladen: even wachten
    if (poging < 40) setTimeout(() => pasVoorkeurenToe(poging + 1), 250);
    return;
  }
  voorkeurenToegepast = true;

  // Favoriete regio
  const regio = mijnProfiel.favoriete_regio ? stadSleutel(mijnProfiel.favoriete_regio) : null;
  const stopInRegio = regio ? alleStops.find(s => groepVan(s) === regio) : null;
  if (stopInRegio) {
    gekozenLand = landVan(stopInRegio);
    gekozenStad = regio;
  }

  // Eén soort gebruik gekozen? Dan zetten we de passende filter al klaar
  const gebruik = mijnProfiel.gebruik || [];
  if (gekozenFilters.length === 0 && gebruik.length === 1) {
    if (gebruik[0] === "koersen") gekozenFilters = ["wieler"];
    if (gebruik[0] === "werken") gekozenFilters = ["laptop"];
  }

  teken();
  if (stopInRegio) setTimeout(zoomNaarStops, 50);
}

// ---------- Profielfoto ----------
document.getElementById("profielFotoKiezer").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";
  if (!bestand) return;
  profielMelding.textContent = t("fotoBezig");
  try {
    const url = await uploadProfielfoto(await vierkanteFoto(bestand, 320));
    await bewaarProfiel({ foto: url });
    await werkMijnReviewsBij({ foto: url });
    zetMijnFoto(url);
    profielMelding.textContent = t("profielBewaard");
  } catch (fout) {
    profielMelding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

document.getElementById("profielFotoWeg").onclick = async () => {
  try {
    await bewaarProfiel({ foto: null });
    await werkMijnReviewsBij({ foto: null });
    await verwijderMijnProfielfotos();
    zetMijnFoto(null);
    profielMelding.textContent = t("profielBewaard");
  } catch (fout) {
    profielMelding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

function zetMijnFoto(url) {
  mijnFoto = url;
  mijnProfiel.foto = url;
  alleReviews.forEach(r => { if (r.user_id === gebruiker.id) r.foto = url; });
  toonAvatarKlein();
  vulProfiel();
  teken();
}

// Een foto vierkant bijsnijden (het midden) en verkleinen
async function vierkanteFoto(bestand, maat) {
  const beeld = await createImageBitmap(bestand);
  const kant = Math.min(beeld.width, beeld.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = maat;
  canvas.getContext("2d").drawImage(beeld,
    (beeld.width - kant) / 2, (beeld.height - kant) / 2, kant, kant,   // het midden van de foto
    0, 0, maat, maat);
  return new Promise(klaar => canvas.toBlob(klaar, "image/jpeg", 0.85));
}

// ---------- Wachtwoord wijzigen ----------
document.getElementById("wachtwoordFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const veld = document.getElementById("profielWachtwoord");
  try {
    await kiesNieuwWachtwoord(veld.value);
    veld.value = "";
    profielMelding.textContent = t("wachtwoordGewijzigd");
  } catch (fout) {
    profielMelding.textContent = leesbareFout(fout);
  }
};

// ---------- "Mijn fiets" alleen tonen als je "Koersen" aanvinkt ----------
function toonFietsKeuze(naam, labelId) {
  const koersen = document.querySelector(`input[name="${naam}"][value="koersen"]`);
  document.getElementById(labelId).hidden = !koersen.checked;
}
document.querySelector('input[name="profielGebruik"][value="koersen"]').onchange =
  () => toonFietsKeuze("profielGebruik", "profielFietsLabel");
document.querySelector('input[name="startGebruik"][value="koersen"]').onchange =
  () => toonFietsKeuze("startGebruik", "startFietsLabel");

// =====================================================
//  PROFIEL AFMAKEN – één keer, net na het aanmaken van je account
// =====================================================
let startFoto = null;   // de foto die je op het startscherm koos

function toonProfielStart(poging = 0) {
  document.getElementById("welkom").hidden = true;
  document.getElementById("app").hidden = true;
  document.getElementById("profielStart").hidden = false;

  // Wat we al weten (bv. van een oudere versie van het aanmeldformulier) alvast aanvinken
  const gebruik = mijnProfiel.gebruik || [];
  document.querySelectorAll('input[name="startGebruik"]').forEach(v => v.checked = gebruik.includes(v.value));
  document.getElementById("startFiets").value = mijnProfiel.fiets || "";
  toonFietsKeuze("startGebruik", "startFietsLabel");
  startFoto = mijnFoto;
  toonStartAvatar();

  // De regio's komen uit de bars: zijn die nog niet geladen, dan even wachten
  if (alleStops.length === 0 && poging < 40) {
    setTimeout(() => { if (!document.getElementById("profielStart").hidden) vulRegioKeuze(mijnProfiel.favoriete_regio || "", "startRegio"); }, 300 * (poging + 1));
  }
  vulRegioKeuze(mijnProfiel.favoriete_regio || "", "startRegio");
}

function toonStartAvatar() {
  document.getElementById("startAvatar").outerHTML =
    avatarHTML(startFoto, mijnVoornaam || gebruiker.email, "groot").replace('class="avatar ', 'id="startAvatar" class="avatar ');
}

// Foto kiezen op het startscherm: meteen uploaden en tonen
document.getElementById("startFotoKiezer").onchange = async (event) => {
  const bestand = event.target.files[0];
  event.target.value = "";
  if (!bestand) return;
  const melding = document.getElementById("startMelding");
  melding.textContent = t("fotoBezig");
  try {
    startFoto = await uploadProfielfoto(await vierkanteFoto(bestand, 320));
    toonStartAvatar();
    melding.textContent = "";
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// "Klaar": alles bewaren en naar de homepage
document.getElementById("startFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const gebruik = [...document.querySelectorAll('input[name="startGebruik"]:checked')].map(v => v.value);
  await rondStartAf({
    gebruik: gebruik,
    favoriete_regio: document.getElementById("startRegio").value || null,
    fiets: gebruik.includes("koersen") ? (document.getElementById("startFiets").value || null) : null,
    foto: startFoto
  });
};

// "Overslaan": niets invullen, wel onthouden dat je het scherm gezien hebt
document.getElementById("startOverslaan").onclick = () => rondStartAf({ foto: startFoto });

async function rondStartAf(velden) {
  const melding = document.getElementById("startMelding");
  try {
    await bewaarProfiel({ ...velden, onboarding_klaar: true });
    Object.assign(mijnProfiel, velden, { onboarding_klaar: true });
    if (velden.foto !== mijnFoto) {
      mijnFoto = velden.foto || null;
      await werkMijnReviewsBij({ foto: mijnFoto });   // (een nieuw account heeft meestal nog geen reviews)
    }
    toonAvatarKlein();
    document.getElementById("profielStart").hidden = true;
    toonScherm();                 // de homepage tonen
    pasVoorkeurenToe();           // je favoriete regio en filters klaarzetten
    // Kwam je binnen via een gedeelde routelink? Die tonen we nu
    if (typeof openGedeeldeRoute === "function") openGedeeldeRoute();
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
}

// Uitgelogd of account verwijderd: het venster sluiten
document.getElementById("uitlogKnop").addEventListener("click", () => venster.open && venster.close());

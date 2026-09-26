// =====================================================
//  KOFFIESTOP – alle logica van de app
// =====================================================

// ---------- 1. De toestand van de app ----------
let alleStops = [];          // komt uit de database
let gekozenStad = "alles";
let gekozenStop = null;      // de id van de stop waarop je klikte
let nieuwePlek = null;       // waar je klikte op de kaart voor een nieuwe stop

// Favorieten: in de browser voor bezoekers, in de database als je bent ingelogd
let favorieten = JSON.parse(localStorage.getItem("favorieten") || "[]");

function bewaarLokaal() {
  localStorage.setItem("favorieten", JSON.stringify(favorieten));
}

// ---------- 2. De kaart ----------
const kaart = L.map("kaart").setView([50.95, 4.1], 8);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(kaart);

const stippen = L.layerGroup().addTo(kaart);

function kleur(type) {
  if (type === "wieler") return "#D9A300";
  if (type === "both") return "#0E7C7B";
  return "#7A4A2E";
}

// ---------- 3. Welke stops tonen we? ----------
function zichtbareStops() {
  const zoekterm = document.getElementById("zoek").value.toLowerCase();
  const type = document.getElementById("type").value;

  return alleStops.filter(stop => {
    if (gekozenStad !== "alles" && stop.stad !== gekozenStad) return false;
    if (type === "coffee" && stop.type === "wieler") return false;
    if (type === "wieler" && stop.type === "coffee") return false;
    if (type === "favoriet" && !favorieten.includes(stop.id)) return false;
    if (!stop.naam.toLowerCase().includes(zoekterm)) return false;
    return true;
  });
}

// ---------- 4. Alles tekenen ----------
function teken() {
  const stops = zichtbareStops();
  tekenKaart(stops);
  tekenLijst(stops);
}

function tekenKaart(stops) {
  stippen.clearLayers();

  for (const stop of stops) {
    const stip = L.circleMarker([stop.lat, stop.lng], {
      radius: stop.id === gekozenStop ? 11 : 7,
      color: "white",
      weight: 2,
      fillColor: kleur(stop.type),
      fillOpacity: 1
    });
    stip.bindTooltip(stop.naam);
    stip.on("click", () => kies(stop.id));
    stip.addTo(stippen);
  }

  if (nieuwePlek) {
    L.circleMarker(nieuwePlek, { radius: 9, color: "red", dashArray: "4" }).addTo(stippen);
  }
}

function tekenLijst(stops) {
  document.getElementById("teller").textContent = stops.length + " " + t("stops");

  const lijst = document.getElementById("lijst");
  lijst.innerHTML = "";

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
      <p></p>
      <div class="acties">
        <a href="${route}" target="_blank">${t("route")}</a>
        ${isBeheerder() ? `<button class="wis">${t("verwijder")}</button>` : ""}
      </div>`;

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

// Stad-knoppen
document.querySelectorAll("#steden button").forEach(knop => {
  knop.onclick = () => {
    gekozenStad = knop.dataset.stad;
    document.querySelectorAll("#steden button").forEach(k => k.classList.remove("actief"));
    knop.classList.add("actief");
    teken();
    zoomNaarStops();
  };
});

document.getElementById("zoek").oninput = teken;
document.getElementById("type").onchange = teken;

// Klikken op de kaart: plek kiezen (alleen voor de beheerder)
kaart.on("click", (event) => {
  if (!isBeheerder()) return;
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
    id: naam.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    naam: naam,
    adres: document.getElementById("nieuwAdres").value.trim(),
    stad: stadVan(nieuwePlek[0], nieuwePlek[1]),
    type: document.getElementById("nieuwWieler").checked ? "both" : "coffee",
    lat: Number(nieuwePlek[0].toFixed(5)),
    lng: Number(nieuwePlek[1].toFixed(5)),
    info: document.getElementById("nieuwInfo").value.trim()
  };

  try {
    await voegStopToeInDatabase(nieuweStop);
    alleStops.push(nieuweStop);
    event.target.reset();
    nieuwePlek = null;
    document.getElementById("plekTekst").textContent = t("kiesPlek");
    kies(nieuweStop.id);
  } catch (fout) {
    document.getElementById("plekTekst").textContent = t("opslaanMislukt") + " " + fout.message;
  }
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
  const toonApp = gebruiker !== null || rondkijken;
  document.getElementById("welkom").hidden = toonApp;
  document.getElementById("app").hidden = !toonApp;
  document.getElementById("ingelogd").hidden = gebruiker === null;

  if (toonApp) {
    // Een kaart die eerst verborgen was, moet zijn grootte opnieuw meten
    setTimeout(() => { kaart.invalidateSize(); zoomNaarStops(); }, 0);
  }
}

// Account maken of inloggen: we sturen een link per mail
document.getElementById("loginFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const bericht = document.getElementById("loginBericht");

  // Voornaam en nieuwsbriefkeuze onthouden tot de gebruiker terugkomt via de link
  localStorage.setItem("nieuwProfiel", JSON.stringify({
    voornaam: document.getElementById("voornaam").value.trim(),
    nieuwsbrief: document.getElementById("nieuwsbriefBijStart").checked
  }));

  try {
    await stuurInloglink(document.getElementById("email").value.trim());
    bericht.textContent = t("checkMail");
  } catch (fout) {
    bericht.textContent = t("loginMislukt") + " " + fout.message;
  }
};

// "Eerst even rondkijken" (alleen als een account niet verplicht is)
document.getElementById("zonderAccount").hidden = ACCOUNT_VERPLICHT;
document.getElementById("zonderAccount").onclick = () => {
  rondkijken = true;
  toonScherm();
};

document.getElementById("uitlogKnop").onclick = logUit;

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
  const wachtend = JSON.parse(localStorage.getItem("nieuwProfiel") || "null");
  let profiel = await haalProfielOp();

  if (!profiel || wachtend) {
    const velden = { taal: taal };
    if (wachtend && wachtend.voornaam) velden.voornaam = wachtend.voornaam;
    // Alleen AANzetten vanuit het welkomstscherm, nooit per ongeluk uitzetten
    if (wachtend && wachtend.nieuwsbrief) {
      velden.nieuwsbrief = true;
      velden.nieuwsbrief_toestemming_op = new Date().toISOString();
    }
    await bewaarProfiel(velden);
    localStorage.removeItem("nieuwProfiel");
    profiel = await haalProfielOp();
  }

  document.getElementById("wie").textContent =
    (profiel && profiel.voornaam) ? profiel.voornaam : gebruiker.email;
  document.getElementById("nieuwsbrief").checked = Boolean(profiel && profiel.nieuwsbrief);
}

// Wordt uitgevoerd bij het openen van de pagina, na inloggen en na uitloggen
async function naInloggen() {
  toonScherm();

  // Het formulier voor nieuwe bars: alleen voor jou
  document.getElementById("formulier").hidden = !isBeheerder();

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
  teken();
}

// ---------- 8. Kleur van de app ----------
function zetKleur(kleur) {
  document.documentElement.style.setProperty("--accent", kleur);
  document.getElementById("eigenKleur").value = kleur;
  document.querySelectorAll(".bolletje").forEach(b =>
    b.classList.toggle("actief", b.dataset.kleur === kleur));
  localStorage.setItem("kleur", kleur);
}

document.querySelectorAll(".bolletje").forEach(b => {
  b.onclick = () => zetKleur(b.dataset.kleur);
});
document.getElementById("eigenKleur").oninput = (event) => zetKleur(event.target.value);

zetKleur(localStorage.getItem("kleur") || "#0E7C7B");

// ---------- 9. Starten ----------
async function start() {
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
  teken();
  zoomNaarStops();

  // Luisteren naar inloggen en uitloggen
  db.auth.onAuthStateChange((gebeurtenis, sessie) => {
    gebruiker = sessie ? sessie.user : null;
    setTimeout(naInloggen, 0);   // even wachten tot Supabase klaar is
  });
}

start();

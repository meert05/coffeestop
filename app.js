// =====================================================
//  KOFFIESTOP – alle logica van de app
// =====================================================

// ---------- 1. De toestand van de app ----------
// Alles wat kan veranderen, bewaren we op één plek.
let alleStops = [];          // wordt gevuld uit stops.json
let gekozenStad = "alles";
let gekozenStop = null;      // de id van de stop waarop je klikte
let nieuwePlek = null;       // waar je klikte op de kaart voor een nieuwe stop

// Favorieten en eigen stops bewaren we in de browser (localStorage),
// zodat ze er nog zijn als je de pagina ververst.
let favorieten = JSON.parse(localStorage.getItem("favorieten") || "[]");
let eigenStops = JSON.parse(localStorage.getItem("eigenStops") || "[]");

function bewaar() {
  localStorage.setItem("favorieten", JSON.stringify(favorieten));
  localStorage.setItem("eigenStops", JSON.stringify(eigenStops));
}

// ---------- 2. De kaart ----------
const kaart = L.map("kaart").setView([50.95, 4.1], 8);   // [breedte, lengte], zoom

// De achtergrond van de kaart komt van OpenStreetMap
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(kaart);

const stippen = L.layerGroup().addTo(kaart);   // hierin komen alle stippen

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

  // De stip voor een nieuwe stop die je aan het toevoegen bent
  if (nieuwePlek) {
    L.circleMarker(nieuwePlek, { radius: 9, color: "red", dashArray: "4" }).addTo(stippen);
  }
}

function tekenLijst(stops) {
  document.getElementById("teller").textContent = stops.length + " stops";

  const lijst = document.getElementById("lijst");
  lijst.innerHTML = "";

  for (const stop of stops) {
    const li = document.createElement("li");
    li.className = stop.type + (stop.id === gekozenStop ? " gekozen" : "");

    const isFavoriet = favorieten.includes(stop.id);
    const route = "https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(stop.naam + " " + stop.adres);

    li.innerHTML = `
      <button class="ster">${isFavoriet ? "★" : "☆"}</button>
      <h3></h3>
      <small></small>
      <p></p>
      <div class="acties">
        <a href="${route}" target="_blank">Route ↗</a>
        ${stop.eigen ? '<button class="wis">Verwijder</button>' : ""}
      </div>`;

    // Tekst zetten we apart met textContent: dat is veiliger dan innerHTML
    li.querySelector("h3").textContent = stop.naam;
    li.querySelector("small").textContent = stop.adres;
    li.querySelector("p").textContent = stop.info;

    // Klikken op de ster: favoriet aan/uit
    li.querySelector(".ster").onclick = (event) => {
      event.stopPropagation();          // zodat de klik niet ook de hele stop kiest
      if (isFavoriet) favorieten = favorieten.filter(id => id !== stop.id);
      else favorieten.push(stop.id);
      bewaar();
      teken();
    };

    // Klikken op "Verwijder" (alleen bij je eigen stops)
    const wisKnop = li.querySelector(".wis");
    if (wisKnop) {
      wisKnop.onclick = (event) => {
        event.stopPropagation();
        eigenStops = eigenStops.filter(s => s.id !== stop.id);
        alleStops = alleStops.filter(s => s.id !== stop.id);
        bewaar();
        teken();
      };
    }

    // Klikken op de kaart: zoom naar die stop
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

// Zoeken en type: bij elke letter opnieuw tekenen
document.getElementById("zoek").oninput = teken;
document.getElementById("type").onchange = teken;

// Klikken op de kaart: plek kiezen voor een nieuwe stop
kaart.on("click", (event) => {
  nieuwePlek = [event.latlng.lat, event.latlng.lng];
  document.getElementById("plekTekst").textContent = "Plek gekozen ✓";
  teken();
});

// Het formulier versturen: nieuwe stop toevoegen
document.getElementById("formulier").onsubmit = (event) => {
  event.preventDefault();   // anders herlaadt de pagina

  if (!nieuwePlek) {
    document.getElementById("plekTekst").textContent = "Klik eerst op de kaart!";
    return;
  }

  const nieuweStop = {
    id: "eigen-" + Date.now(),                 // unieke id op basis van de tijd
    naam: document.getElementById("nieuwNaam").value,
    adres: "",
    stad: gekozenStad === "alles" ? "hellingen" : gekozenStad,
    type: document.getElementById("nieuwWieler").checked ? "both" : "coffee",
    lat: nieuwePlek[0],
    lng: nieuwePlek[1],
    info: document.getElementById("nieuwInfo").value,
    eigen: true
  };

  eigenStops.push(nieuweStop);
  alleStops.push(nieuweStop);
  bewaar();

  // Formulier leegmaken
  event.target.reset();
  nieuwePlek = null;
  document.getElementById("plekTekst").textContent = "Klik op de kaart om de plek te kiezen.";
  kies(nieuweStop.id);
};

// Zoom de kaart zodat alle zichtbare stops erop passen
function zoomNaarStops() {
  const stops = zichtbareStops();
  if (stops.length === 0) return;
  const grenzen = L.latLngBounds(stops.map(s => [s.lat, s.lng]));
  kaart.fitBounds(grenzen, { padding: [30, 30] });
}

// ---------- 7. Starten: data inladen ----------
fetch("stops.json")
  .then(antwoord => antwoord.json())
  .then(data => {
    alleStops = data.concat(eigenStops);
    teken();
    zoomNaarStops();
  })
  .catch(() => {
    document.getElementById("teller").textContent =
      "Kon stops.json niet laden. Start je de app via de lokale server?";
  });

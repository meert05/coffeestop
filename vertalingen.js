// =====================================================
//  VERTALINGEN – alle teksten van de app, per taal
// =====================================================

const teksten = {
  nl: {
    ondertitel: "Koffiebars en wielercafés in Vlaanderen en Brussel",
    kleur: "Kleur:",
    alles: "Alles",
    vlaanderen: "Vlaanderen",
        antwerpen: "Antwerpen",
    gent: "Gent",
    brussel: "Brussel",
    zoek: "Zoek een stop…",
    alleTypes: "Alle types",
    koffie: "Specialty koffie",
    wieler: "Wielercafé",
    favorieten: "★ Mijn favorieten",
    nieuweStop: "Nieuwe stop",
    naam: "Naam",
    beschrijving: "Korte beschrijving",
    wielervriendelijk: "Wielervriendelijk",
    kiesPlek: "Klik op de kaart om de plek te kiezen.",
    plekGekozen: "Plek gekozen ✓",
    eerstKlikken: "Klik eerst op de kaart!",
    toevoegen: "Toevoegen",
    stops: "stops",
    route: "Route ↗",
    verwijder: "Verwijder",
    fout: "Kon stops.json niet laden. Start je de app via de lokale server?"
  },

  fr: {
    ondertitel: "Bars à café et cafés cyclistes en Flandre et à Bruxelles",
    kleur: "Couleur :",
    alles: "Tout",
    vlaanderen: "Flandre",
        antwerpen: "Anvers",
    gent: "Gand",
    brussel: "Bruxelles",
    zoek: "Chercher un arrêt…",
    alleTypes: "Tous les types",
    koffie: "Café de spécialité",
    wieler: "Café cycliste",
    favorieten: "★ Mes favoris",
    nieuweStop: "Nouvel arrêt",
    naam: "Nom",
    beschrijving: "Courte description",
    wielervriendelijk: "Adapté aux cyclistes",
    kiesPlek: "Cliquez sur la carte pour choisir l'endroit.",
    plekGekozen: "Endroit choisi ✓",
    eerstKlikken: "Cliquez d'abord sur la carte !",
    toevoegen: "Ajouter",
    stops: "arrêts",
    route: "Itinéraire ↗",
    verwijder: "Supprimer",
    fout: "Impossible de charger stops.json. L'app tourne-t-elle via le serveur local ?"
  },

  en: {
    ondertitel: "Coffee bars and cycling cafés in Flanders and Brussels",
    kleur: "Colour:",
    alles: "All",
    vlaanderen: "Flanders",
        antwerpen: "Antwerp",
    gent: "Ghent",
    brussel: "Brussels",
    zoek: "Search a stop…",
    alleTypes: "All types",
    koffie: "Specialty coffee",
    wieler: "Cycling café",
    favorieten: "★ My favourites",
    nieuweStop: "New stop",
    naam: "Name",
    beschrijving: "Short description",
    wielervriendelijk: "Cyclist-friendly",
    kiesPlek: "Click on the map to choose the spot.",
    plekGekozen: "Spot chosen ✓",
    eerstKlikken: "Click on the map first!",
    toevoegen: "Add",
    stops: "stops",
    route: "Directions ↗",
    verwijder: "Delete",
    fout: "Couldn't load stops.json. Are you running the app through the local server?"
  }
};

// De gekozen taal: eerst kijken wat je vorige keer koos, anders Nederlands
let taal = localStorage.getItem("taal") || "nl";

// t("zoek") geeft de tekst "zoek" terug in de gekozen taal
function t(sleutel) {
  return teksten[taal][sleutel];
}

// Zet alle teksten op de pagina in de gekozen taal
function vertaalPagina() {
  document.documentElement.lang = taal;

  // Elementen met data-t="..." krijgen de vertaalde tekst
  document.querySelectorAll("[data-t]").forEach(el => {
    el.textContent = t(el.dataset.t);
  });

  // Invulvakken met data-t-placeholder="..." krijgen een vertaalde voorbeeldtekst
  document.querySelectorAll("[data-t-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.tPlaceholder);
  });

  // Het actieve taalknopje markeren
  document.querySelectorAll("#talen button").forEach(knop => {
    knop.classList.toggle("actief", knop.dataset.taal === taal);
  });
}

// Klikken op NL / FR / EN
document.querySelectorAll("#talen button").forEach(knop => {
  knop.onclick = () => {
    taal = knop.dataset.taal;
    localStorage.setItem("taal", taal);   // onthouden voor de volgende keer
    vertaalPagina();
    teken();                              // de lijst opnieuw tekenen in de nieuwe taal
  };
});

vertaalPagina();

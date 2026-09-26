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
    email: "jouw@email.be",
    inloggen: "Inloggen",
    uitloggen: "Uitloggen",
    checkMail: "Check je mailbox en klik op de link om in te loggen.",
    loginMislukt: "Inloggen lukte niet:",
    privacy: "We bewaren alleen je voornaam, je e-mailadres, je favorieten en je nieuwsbriefkeuze. Je kunt je altijd uitschrijven.",
    welkomTitel: "Maak een gratis account",
    welkomTekst: "Ontdek de beste koffiestops, bewaar je favorieten en mis geen enkele nieuwe bar.",
    voornaam: "Voornaam",
    nieuwsbriefVraag: "Ja, stuur me maandelijks een mail met nieuwe bars.",
    nieuwsbriefKort: "Maandelijkse mail",
    accountMaken: "Account maken of inloggen",
    zonderAccount: "Eerst even rondkijken",
    adres: "Adres",
    opslaanMislukt: "Opslaan lukte niet:",
    zekerVerwijderen: "Zeker verwijderen?",
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
    email: "ton@email.be",
    inloggen: "Se connecter",
    uitloggen: "Se déconnecter",
    checkMail: "Vérifie ta boîte mail et clique sur le lien pour te connecter.",
    loginMislukt: "Connexion impossible :",
    privacy: "Nous gardons uniquement ton prénom, ton adresse e-mail, tes favoris et ton choix de newsletter. Tu peux te désinscrire à tout moment.",
    welkomTitel: "Crée un compte gratuit",
    welkomTekst: "Découvre les meilleurs arrêts café, garde tes favoris et ne rate aucun nouveau bar.",
    voornaam: "Prénom",
    nieuwsbriefVraag: "Oui, envoie-moi chaque mois un e-mail avec les nouveaux bars.",
    nieuwsbriefKort: "E-mail mensuel",
    accountMaken: "Créer un compte ou se connecter",
    zonderAccount: "D'abord jeter un œil",
    adres: "Adresse",
    opslaanMislukt: "Enregistrement impossible :",
    zekerVerwijderen: "Vraiment supprimer ?",
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
    email: "your@email.com",
    inloggen: "Log in",
    uitloggen: "Log out",
    checkMail: "Check your inbox and click the link to log in.",
    loginMislukt: "Couldn't log in:",
    privacy: "We only store your first name, email address, favourites and newsletter choice. You can unsubscribe at any time.",
    welkomTitel: "Create a free account",
    welkomTekst: "Discover the best coffee stops, save your favourites and never miss a new bar.",
    voornaam: "First name",
    nieuwsbriefVraag: "Yes, send me a monthly email with new bars.",
    nieuwsbriefKort: "Monthly email",
    accountMaken: "Create account or log in",
    zonderAccount: "Just have a look first",
    adres: "Address",
    opslaanMislukt: "Couldn't save:",
    zekerVerwijderen: "Really delete?",
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

// =====================================================
//  VERTALINGEN – alle teksten van de app, per taal
// =====================================================

const teksten = {
  nl: {
    tabNieuw: "Account maken",
    tabLogin: "Inloggen",
    wachtwoord: "Wachtwoord",
    wachtwoordNieuw: "Wachtwoord (min. 8 tekens)",
    vergeten: "Wachtwoord vergeten?",
    nieuwWachtwoordTitel: "Kies een nieuw wachtwoord",
    bewaarWachtwoord: "Bewaar wachtwoord",
    bevestigMail: "Bijna klaar! We stuurden je één mail om je e-mailadres te bevestigen. Daarna log je gewoon in met je wachtwoord.",
    resetVerstuurd: "Check je mailbox: we stuurden je een link om een nieuw wachtwoord te kiezen.",
    eerstEmail: "Vul eerst je e-mailadres in.",
    foutGegevens: "E-mailadres of wachtwoord klopt niet.",
    foutBevestigen: "Bevestig eerst je e-mailadres via de mail die we je stuurden.",
    foutBestaat: "Er bestaat al een account met dit e-mailadres. Log in, of kies 'Wachtwoord vergeten?'.",
    foutWachtwoord: "Kies een wachtwoord van minstens 8 tekens.",
    ondertitel: "Koffiebars en wielercafés in Vlaanderen en Brussel",
    kleur: "Kleur:",
    alleLanden: "Alle landen",
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
    welkomTitel: "Welkom bij Koffiestop",
    welkomTekst: "Ontdek de beste koffiestops, bewaar je favorieten en mis geen enkele nieuwe bar.",
    voornaam: "Voornaam",
    nieuwsbriefVraag: "Ja, stuur me maandelijks een mail met nieuwe bars.",
    nieuwsbriefKort: "Maandelijkse mail",
    accountMaken: "Account maken",
    zonderAccount: "Eerst even rondkijken",
    adres: "Straat nr, gemeente",
    opslaanMislukt: "Opslaan lukte niet:",
    zekerVerwijderen: "Zeker verwijderen?",
    foto: "📷 Foto",
    fotoKiezen: "Foto (optioneel)",
    fotoBezig: "Foto uploaden…",
    zoek: "Zoek een stop…",
    alleTypes: "Alle types",
    koffie: "Specialty koffie",
    wieler: "Wielercafé",
    favorieten: "★ Mijn favorieten",
    nieuweStop: "Nieuwe stop",
    naam: "Naam",
    beschrijving: "Korte beschrijving",
    wielervriendelijk: "Wielervriendelijk",
    kiesPlek: "Vul een adres in en klik op 📍, of klik op de kaart.",
    plekGekozen: "Plek gekozen ✓",
    eerstKlikken: "Zoek eerst het adres op, of klik op de kaart!",
    toevoegen: "Toevoegen",
    stops: "stops",
    route: "Route ↗",
    verwijder: "Verwijder",
    fout: "Kon stops.json niet laden. Start je de app via de lokale server?",
    zoekOpKaart: "📍 Zoek op kaart",
    plaats: "Gemeente",
    land: "Land",
    eerstAdres: "Vul eerst een adres in.",
    adresZoeken: "Adres zoeken…",
    adresGevonden: "Gevonden! Staat de speld niet helemaal juist? Versleep ze.",
    adresNietGevonden: "Adres niet gevonden. Probeer met straat, nummer en gemeente, of klik op de kaart.",
  },

  fr: {
    tabNieuw: "Créer un compte",
    tabLogin: "Se connecter",
    wachtwoord: "Mot de passe",
    wachtwoordNieuw: "Mot de passe (min. 8 caractères)",
    vergeten: "Mot de passe oublié ?",
    nieuwWachtwoordTitel: "Choisis un nouveau mot de passe",
    bewaarWachtwoord: "Enregistrer le mot de passe",
    bevestigMail: "Presque fini ! Nous t'avons envoyé un e-mail pour confirmer ton adresse. Ensuite, connecte-toi simplement avec ton mot de passe.",
    resetVerstuurd: "Vérifie ta boîte mail : nous t'avons envoyé un lien pour choisir un nouveau mot de passe.",
    eerstEmail: "Remplis d'abord ton adresse e-mail.",
    foutGegevens: "Adresse e-mail ou mot de passe incorrect.",
    foutBevestigen: "Confirme d'abord ton adresse via l'e-mail que nous t'avons envoyé.",
    foutBestaat: "Un compte existe déjà avec cette adresse. Connecte-toi ou choisis « Mot de passe oublié ? ».",
    foutWachtwoord: "Choisis un mot de passe d'au moins 8 caractères.",
    ondertitel: "Bars à café et cafés cyclistes en Flandre et à Bruxelles",
    kleur: "Couleur :",
    alleLanden: "Tous les pays",
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
    welkomTitel: "Bienvenue sur Koffiestop",
    welkomTekst: "Découvre les meilleurs arrêts café, garde tes favoris et ne rate aucun nouveau bar.",
    voornaam: "Prénom",
    nieuwsbriefVraag: "Oui, envoie-moi chaque mois un e-mail avec les nouveaux bars.",
    nieuwsbriefKort: "E-mail mensuel",
    accountMaken: "Créer un compte",
    zonderAccount: "D'abord jeter un œil",
    adres: "Rue n°, commune",
    opslaanMislukt: "Enregistrement impossible :",
    zekerVerwijderen: "Vraiment supprimer ?",
    foto: "📷 Photo",
    fotoKiezen: "Photo (facultatif)",
    fotoBezig: "Envoi de la photo…",
    zoek: "Chercher un arrêt…",
    alleTypes: "Tous les types",
    koffie: "Café de spécialité",
    wieler: "Café cycliste",
    favorieten: "★ Mes favoris",
    nieuweStop: "Nouvel arrêt",
    naam: "Nom",
    beschrijving: "Courte description",
    wielervriendelijk: "Adapté aux cyclistes",
    kiesPlek: "Entre une adresse et clique sur 📍, ou clique sur la carte.",
    plekGekozen: "Endroit choisi ✓",
    eerstKlikken: "Cherche d'abord l'adresse, ou clique sur la carte !",
    toevoegen: "Ajouter",
    stops: "arrêts",
    route: "Itinéraire ↗",
    verwijder: "Supprimer",
    fout: "Impossible de charger stops.json. L'app tourne-t-elle via le serveur local ?",
    zoekOpKaart: "📍 Chercher sur la carte",
    plaats: "Commune",
    land: "Pays",
    eerstAdres: "Entre d'abord une adresse.",
    adresZoeken: "Recherche de l'adresse…",
    adresGevonden: "Trouvé ! L'épingle n'est pas tout à fait au bon endroit ? Déplace-la.",
    adresNietGevonden: "Adresse introuvable. Essaie avec rue, numéro et commune, ou clique sur la carte.",
  },

  en: {
    tabNieuw: "Create account",
    tabLogin: "Log in",
    wachtwoord: "Password",
    wachtwoordNieuw: "Password (min. 8 characters)",
    vergeten: "Forgot your password?",
    nieuwWachtwoordTitel: "Choose a new password",
    bewaarWachtwoord: "Save password",
    bevestigMail: "Almost there! We sent you one email to confirm your address. After that, just log in with your password.",
    resetVerstuurd: "Check your inbox: we sent you a link to choose a new password.",
    eerstEmail: "Fill in your email address first.",
    foutGegevens: "Email address or password is incorrect.",
    foutBevestigen: "Please confirm your email address first, using the email we sent you.",
    foutBestaat: "An account with this email already exists. Log in, or choose 'Forgot your password?'.",
    foutWachtwoord: "Choose a password of at least 8 characters.",
    ondertitel: "Coffee bars and cycling cafés in Flanders and Brussels",
    kleur: "Colour:",
    alleLanden: "All countries",
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
    welkomTitel: "Welcome to Koffiestop",
    welkomTekst: "Discover the best coffee stops, save your favourites and never miss a new bar.",
    voornaam: "First name",
    nieuwsbriefVraag: "Yes, send me a monthly email with new bars.",
    nieuwsbriefKort: "Monthly email",
    accountMaken: "Create account",
    zonderAccount: "Just have a look first",
    adres: "Street no., town",
    opslaanMislukt: "Couldn't save:",
    zekerVerwijderen: "Really delete?",
    foto: "📷 Photo",
    fotoKiezen: "Photo (optional)",
    fotoBezig: "Uploading photo…",
    zoek: "Search a stop…",
    alleTypes: "All types",
    koffie: "Specialty coffee",
    wieler: "Cycling café",
    favorieten: "★ My favourites",
    nieuweStop: "New stop",
    naam: "Name",
    beschrijving: "Short description",
    wielervriendelijk: "Cyclist-friendly",
    kiesPlek: "Enter an address and click 📍, or click on the map.",
    plekGekozen: "Spot chosen ✓",
    eerstKlikken: "Look up the address first, or click on the map!",
    toevoegen: "Add",
    stops: "stops",
    route: "Directions ↗",
    verwijder: "Delete",
    fout: "Couldn't load stops.json. Are you running the app through the local server?",
    zoekOpKaart: "📍 Find on map",
    plaats: "Town",
    land: "Country",
    eerstAdres: "Enter an address first.",
    adresZoeken: "Looking up address…",
    adresGevonden: "Found! Pin not quite right? Drag it.",
    adresNietGevonden: "Address not found. Try street, number and town, or click on the map.",
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

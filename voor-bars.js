// =====================================================
//  WAYPOUR – pagina "Voor koffiebars" (voor-bars.html)
// =====================================================
// * Nederlands staat in de HTML zelf, Frans hieronder.
// * Een bar vult alles in zoals het op de kaart moet komen (adres, uren, kenmerken, foto).
//   Het gaat naar de tabel bar_aanvragen en de foto naar de map aanvraag-fotos (bar-aanvragen.sql).
//   Jij ziet het in de app: ⚙️ Beheer → 📊 Cijfers → Aanvragen van bars → "➕ Op de kaart zetten".

const FRANS = {
  balkTitel: "pour les cafés",
  naarApp: "Ouvrir l'app",
  kicker: "Pour les cafés",
  titel: "Les cyclistes et les amateurs de café trouvent ton café.",
  intro: "Waypour est une carte des meilleurs cafés de spécialité de Belgique, pour ceux qui roulent, travaillent ou cherchent simplement un bon café. Les cyclistes y planifient leur sortie avec une pause café et donnent rendez-vous à leurs amis. Une place sur la carte est gratuite, et jamais à vendre.",
  knopAanmelden: "Propose ton café – gratuit",
  knopApp: "Voir l'app",
  watTitel: "Ce que fait Waypour",
  watUitleg: "Créé par un étudiant et cycliste belge, pour ceux qui préfèrent un bon café au plus proche.",
  wat1Titel: "Une carte avec uniquement du bon café",
  wat1: "Par ville et par région, avec les heures d'ouverture, des photos et ce qui t'attend : cycling-friendly, adapté au laptop, ouvert le dimanche.",
  wat2Titel: "Des parcours avec une pause café",
  wat2: "Les cyclistes planifient une sortie qui passe par ton café et l'envoient sur leur Garmin ou Wahoo. Ils s'arrêtent chez toi plutôt qu'à la première station-service.",
  wat3Titel: "Se donner rendez-vous",
  wat3: "Des amis s'invitent pour une sortie vers un café, avec jour et heure. Un groupe de cinq à ton comptoir, le dimanche matin.",
  kiesTitel: "Comment choisissons-nous les cafés ?",
  kiesUitleg: "Waypour ne vaut quelque chose que si la liste est juste. Ces règles valent donc pour tout le monde.",
  b1Titel: "Nous choisissons nous-mêmes, sur le café",
  b1: "Du café de spécialité, préparé avec soin. Nous y allons nous-mêmes ou nous fions à des gens que nous connaissons.",
  b2Titel: "Une place n'est jamais à vendre",
  b2: "On ne peut pas payer pour une place ou une meilleure position dans la liste. Chaque café y est pour son café.",
  b3Titel: "La qualité compte, toujours",
  b3: "Si le café baisse en qualité, le café disparaît de la carte.",
  b4Titel: "Pas de publicité, pas de vente de données",
  b4: "Les utilisateurs ne voient pas de bannières et nous ne vendons jamais de données. Tout ce qui est payé est clairement indiqué.",
  aanbodTitel: "Qu'est-ce que tu reçois ? Tout est gratuit.",
  aanbodUitleg: "Une place sur Waypour ne coûte rien et ne coûtera jamais rien. Il n'y a pas de version payante : chaque café sélectionné reçoit la même chose.",
  v1Titel: "Sur la carte",
  v1: "Avec photo, heures d'ouverture, un court texte et des labels comme cycling-friendly.",
  v2Titel: "Tes chiffres, chaque mois",
  v2: "Combien de fois ton café a été consulté, combien de fois on a demandé l'itinéraire et combien de fois tu étais dans un parcours vélo ou une sortie en groupe. Anonyme et gratuit.",
  v3Titel: "Une coffee ride ensemble",
  v3: "Envie qu'une sortie parte ou se termine chez toi ? On l'organise ensemble et on la met dans l'app.",
  v4Titel: "Tes infos sont justes",
  v4: "Nouveaux horaires, nouvelle photo ou autres grains ? Dis-le-nous et nous mettons à jour.",
  fietsTitel: "Que veut dire cycling-friendly ?",
  fietsUitleg: "Ces cafés ont un label dans l'app, et les cyclistes les cherchent. On s'y arrête facilement pendant une sortie.",
  t1: "Ton vélo peut rester en sécurité, de préférence en vue de la terrasse ou de la vitrine.",
  t2: "Tenue cycliste et chaussures à cales ne posent aucun problème.",
  t3: "On peut y remplir son bidon.",
  t4: "En plus : ouvert le week-end dès 8 h, une pompe ou quelques outils derrière le comptoir.",
  formTitel: "Propose ton café",
  formUitleg: "Remplis tout comme cela doit apparaître sur la carte. Je vérifie ton café et je l'ajoute en général dans la semaine. Ton café est déjà sur la carte ? Utilise ce formulaire pour mettre tes infos à jour.",
  deelBar: "1. Ton café",
  vBar: "Nom du café *",
  vStraat: "Rue et numéro *",
  vPostcode: "Code postal *",
  vGemeente: "Commune *",
  vLand: "Pays",
  landBE: "Belgique", landNL: "Pays-Bas", landFR: "France", landLU: "Luxembourg", landDE: "Allemagne",
  vInstagram: "Instagram (facultatif)",
  vWebsite: "Site web (facultatif)",
  vInfo: "Courte description *",
  vInfoVoorbeeld: "P. ex. Torréfaction maison, café filtre avec des grains qui changent, grande terrasse et un range-vélos bien en vue.",
  deelUren: "2. Heures d'ouverture",
  dag_ma: "Lundi", dag_di: "Mardi", dag_wo: "Mercredi", dag_do: "Jeudi", dag_vr: "Vendredi", dag_za: "Samedi", dag_zo: "Dimanche",
  gesloten: "Fermé",
  zelfdeUren: "Reprendre les heures du lundi partout",
  urenUitleg: "Pause de midi ou autre particularité ? Indique-le dans ton message plus bas.",
  deelKenmerken: "3. À quoi peut-on s'attendre ?",
  kWieler: "Cycling-friendly",
  kWielerUitleg: "Vélo en sécurité (en vue), tenue cycliste et cales bienvenues, remplir son bidon.",
  kLaptop: "PC-friendly",
  kLaptopUitleg: "Wifi, prises et on peut y travailler un moment.",
  deelFoto: "4. Une photo",
  fotoKiezen: "Choisir une photo",
  fotoAnders: "Choisir une autre photo",
  fotoUitleg: "De préférence en paysage, de ton café ou de ton café en tasse. Ça peut aussi venir plus tard.",
  deelContact: "5. Contact",
  vNaam: "Ton nom *",
  vEmail: "Adresse e-mail *",
  vTelefoon: "Téléphone (facultatif)",
  kRit: "Je veux organiser une coffee ride ensemble",
  vBericht: "Message (facultatif)",
  versturen: "Proposer mon café",
  privacyZin: "Nous utilisons tes données uniquement pour mettre ton café sur la carte et te contacter au sujet de Waypour.",
  privacyLink: "Politique de confidentialité",
  bedanktTitel: "Merci !",
  bedankt: "Ta proposition est bien arrivée. Je vérifie ton café et je te recontacte dans quelques jours.",
  mVelden: "Remplis les champs marqués d'un *.",
  mEmail: "Cette adresse e-mail ne semble pas correcte.",
  mUren: "Vérifie les heures d'ouverture : indique une heure de début et de fin, ou coche « Fermé ».",
  mBezig: "Envoi…",
  mFotoBezig: "Envoi de la photo…",
  mFoto: "Cette photo n'a pas pu être lue. Essaie une autre (JPG ou PNG).",
  mFout: "L'envoi n'a pas fonctionné. Réessaie plus tard ou écris à meertmilan@gmail.com."
};

// De meldingen in het Nederlands (de rest staat in de HTML)
const NEDERLANDS = {
  fotoAnders: "Kies een andere foto",
  mVelden: "Vul de velden met een * in.",
  mEmail: "Dit e-mailadres lijkt niet juist.",
  mUren: "Kijk de openingsuren na: vul een begin- en einduur in, of vink \"Gesloten\" aan.",
  mBezig: "Versturen…",
  mFotoBezig: "Foto versturen…",
  mFoto: "Deze foto kon niet gelezen worden. Probeer een andere (JPG of PNG).",
  mFout: "Versturen lukte niet. Probeer het later opnieuw of mail naar meertmilan@gmail.com."
};
// De Nederlandse teksten onthouden zoals ze in de HTML staan
document.querySelectorAll("[data-k]").forEach(el => { NEDERLANDS[el.dataset.k] = el.textContent; });
document.querySelectorAll("[data-k-placeholder]").forEach(el => { NEDERLANDS[el.dataset.kPlaceholder] = el.placeholder; });

let paginaTaal = "nl";
function tekst(sleutel) {
  return (paginaTaal === "fr" ? FRANS : NEDERLANDS)[sleutel] || NEDERLANDS[sleutel] || "";
}

function zetTaal(nieuw) {
  paginaTaal = nieuw === "fr" ? "fr" : "nl";
  document.documentElement.lang = paginaTaal;
  document.title = paginaTaal === "fr" ? "Pour les cafés – Waypour" : "Voor koffiebars – Waypour";
  document.querySelectorAll("[data-k]").forEach(el => { el.textContent = tekst(el.dataset.k); });
  document.querySelectorAll("[data-k-placeholder]").forEach(el => { el.placeholder = tekst(el.dataset.kPlaceholder); });
  document.querySelectorAll('a[data-k="privacyLink"]').forEach(a => {
    a.href = paginaTaal === "fr" ? "privacy-en.html" : "privacy.html";   // geen Franse versie: de Engelse
  });
  document.querySelectorAll(".talen button").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.taal === paginaTaal));
  if (fotoBlob) document.querySelector('.fotoKnop span').textContent = tekst("fotoAnders");
  try { localStorage.setItem("taal", paginaTaal); } catch {}
}

document.querySelectorAll(".talen button").forEach(knop => { knop.onclick = () => zetTaal(knop.dataset.taal); });

// ---------- Openingsuren ----------
const DAGCODES = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const formulier = document.getElementById("aanvraag");
const melding = document.getElementById("formMelding");

function tekenDag(dag) {
  const rij = formulier.querySelector(`.dag[data-dag="${dag}"]`);
  const dicht = formulier.elements["dicht_" + dag].checked;
  rij.classList.toggle("gesloten", dicht);
  formulier.elements["van_" + dag].disabled = dicht;
  formulier.elements["tot_" + dag].disabled = dicht;
}
DAGCODES.forEach(dag => {
  formulier.elements["dicht_" + dag].onchange = () => tekenDag(dag);
  tekenDag(dag);
});
document.getElementById("zelfdeUren").onclick = () => {
  const van = formulier.elements.van_ma.value, tot = formulier.elements.tot_ma.value;
  const dicht = formulier.elements.dicht_ma.checked;
  for (const dag of DAGCODES.slice(1)) {
    formulier.elements["van_" + dag].value = van;
    formulier.elements["tot_" + dag].value = tot;
    formulier.elements["dicht_" + dag].checked = dicht;
    tekenDag(dag);
  }
};

// { ma: "08:00-17:00", ..., zo: "" } zoals in de app; null als er iets niet klopt
function leesUren() {
  const uren = {};
  for (const dag of DAGCODES) {
    if (formulier.elements["dicht_" + dag].checked) { uren[dag] = ""; continue; }
    const van = formulier.elements["van_" + dag].value, tot = formulier.elements["tot_" + dag].value;
    if (!van || !tot) return null;
    uren[dag] = van + "-" + tot;
  }
  return uren;
}

// Teller onder de beschrijving
const infoVeld = formulier.elements.info;
infoVeld.oninput = () => { document.getElementById("infoTeller").textContent = infoVeld.value.length + " / 400"; };

// ---------- De foto: verkleinen tot max. 1600 px en als JPG bewaren ----------
let fotoBlob = null;
function verkleinFotoVoorAanvraag(bestand, maximum = 1600) {
  return new Promise((klaar, mislukt) => {
    const beeld = new Image();
    const url = URL.createObjectURL(bestand);
    beeld.onload = () => {
      const schaal = Math.min(1, maximum / Math.max(beeld.width, beeld.height));
      const doek = document.createElement("canvas");
      doek.width = Math.round(beeld.width * schaal);
      doek.height = Math.round(beeld.height * schaal);
      doek.getContext("2d").drawImage(beeld, 0, 0, doek.width, doek.height);
      URL.revokeObjectURL(url);
      doek.toBlob(blob => blob ? klaar(blob) : mislukt(new Error("geen foto")), "image/jpeg", 0.85);
    };
    beeld.onerror = () => { URL.revokeObjectURL(url); mislukt(new Error("geen foto")); };
    beeld.src = url;
  });
}
document.getElementById("fotoInvoer").onchange = async (event) => {
  const bestand = event.target.files[0];
  if (!bestand) return;
  try {
    fotoBlob = await verkleinFotoVoorAanvraag(bestand);
    const voorbeeld = document.getElementById("fotoVoorbeeld");
    voorbeeld.src = URL.createObjectURL(fotoBlob);
    voorbeeld.hidden = false;
    document.querySelector(".fotoKnop span").textContent = tekst("fotoAnders");
    melding.textContent = "";
  } catch {
    fotoBlob = null;
    melding.textContent = tekst("mFoto");
  }
};

// Welke taal eerst? ?taal=fr in de link, anders je vorige keuze, anders de taal van je toestel
(function () {
  const uitLink = new URLSearchParams(location.search).get("taal");
  let bewaard = null;
  try { bewaard = localStorage.getItem("taal"); } catch {}
  const toestel = (navigator.language || "nl").slice(0, 2);
  zetTaal(uitLink || bewaard || (toestel === "fr" ? "fr" : "nl"));
})();

// ---------- Versturen ----------
formulier.onsubmit = async (event) => {
  event.preventDefault();
  const veld = (naam) => String(formulier.elements[naam].value || "").trim();
  if (veld("website2")) return;   // een spamrobot vulde het verborgen vakje in

  const verplicht = ["bar", "straat", "postcode", "gemeente", "info", "naam", "email"];
  const leeg = verplicht.find(naam => !veld(naam));
  if (leeg) { melding.textContent = tekst("mVelden"); formulier.elements[leeg].focus(); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(veld("email"))) { melding.textContent = tekst("mEmail"); formulier.elements.email.focus(); return; }
  const uren = leesUren();
  if (!uren) { melding.textContent = tekst("mUren"); return; }

  const knop = formulier.querySelector('button[type="submit"]');
  knop.disabled = true;
  try {
    // Eerst de foto (als er een is)
    let fotoPad = null;
    if (fotoBlob) {
      melding.textContent = tekst("mFotoBezig");
      fotoPad = await uploadAanvraagFoto(fotoBlob);
    }
    melding.textContent = tekst("mBezig");
    let website = veld("website");
    if (website && !/^https?:\/\//i.test(website)) website = "https://" + website;
    await stuurBarAanvraag({
      bar: veld("bar").slice(0, 100),
      straat: veld("straat").slice(0, 150),
      postcode: veld("postcode").slice(0, 12),
      gemeente: veld("gemeente").slice(0, 100),
      landcode: /^[A-Z]{2}$/.test(veld("landcode")) ? veld("landcode") : "BE",
      instagram: veld("instagram").slice(0, 100) || null,
      website: website.slice(0, 200) || null,
      info: veld("info").slice(0, 400),
      openingsuren: uren,
      wieler: formulier.elements.wieler.checked,
      laptop: formulier.elements.laptop.checked,
      foto: fotoPad,
      naam: veld("naam").slice(0, 80),
      email: veld("email").slice(0, 200),
      telefoon: veld("telefoon").slice(0, 40) || null,
      interesse: formulier.elements.rit.checked ? "rit" : "aanmelden",
      bericht: veld("bericht").slice(0, 1000) || null,
      taal: paginaTaal
    });
    formulier.hidden = true;
    document.getElementById("bedankt").hidden = false;
    document.getElementById("bedankt").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (fout) {
    console.error(fout);
    melding.textContent = tekst("mFout");
  } finally {
    knop.disabled = false;
  }
};

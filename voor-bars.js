// =====================================================
//  WAYPOUR – pagina "Voor koffiebars" (voor-bars.html)
// =====================================================
// * Nederlands staat in de HTML zelf, Frans hieronder.
// * Het formulier stuurt een aanvraag naar de tabel bar_aanvragen (bar-aanvragen.sql).
//   Jij ziet ze in de app: ⚙️ Beheer → 📊 Cijfers → Aanvragen van bars.

const FRANS = {
  balkTitel: "pour les cafés",
  naarApp: "Ouvrir l'app",
  kicker: "Pour les cafés",
  titel: "Les cyclistes et les amateurs de café trouvent ton café.",
  intro: "Waypour est une carte des meilleurs cafés de spécialité de Belgique, pour ceux qui roulent, travaillent ou cherchent simplement un bon café. Les cyclistes y planifient leur sortie avec une pause café et donnent rendez-vous à leurs amis. Une place sur la carte est gratuite, et jamais à vendre.",
  knopAanmelden: "Inscris ton café – gratuit",
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
  b2: "Payer ne donne pas une meilleure place dans la liste ou sur la carte. Même pas en tant que partenaire.",
  b3Titel: "La qualité compte, toujours",
  b3: "Si le café baisse en qualité, le café disparaît de la carte. Même s'il paie.",
  b4Titel: "Pas de publicité, pas de vente de données",
  b4: "Les utilisateurs ne voient pas de bannières et nous ne vendons jamais de données. Tout ce qui est payé est clairement indiqué.",
  aanbodTitel: "Qu'est-ce que tu reçois ?",
  aanbodUitleg: "Être sur la carte est gratuit. Si tu veux plus, une petite formule arrive pour les cafés sélectionnés.",
  gratisTitel: "Gratuit",
  gratisPil: "Pour chaque café sélectionné",
  g1: "Ton café est sur la carte et dans la liste, avec photo, heures d'ouverture et un court texte",
  g2: "Chaque mois tes chiffres par e-mail : combien de fois ton café a été consulté, combien de fois on a demandé l'itinéraire et combien de fois tu étais dans un parcours vélo ou une sortie en groupe",
  g3: "Tes infos sont justes : envoie-nous de nouvelles photos, heures ou un texte, nous les mettons à jour",
  gratisVoet: "Pas de contrat, pas de frais.",
  pakketTitel: "Formule café",
  pakketPil: "Bientôt",
  perMaand: "par mois",
  p1: "Tout ce qui est gratuit",
  p2: "Des chiffres plus détaillés, avec l'évolution de mois en mois",
  p3: "Tes événements dans l'app : une coffee ride depuis ton café, de nouveaux grains, une soirée latte art",
  p4: "Plus tard : modifier toi-même tes photos, heures et texte",
  p5: "Un autocollant « Sur Waypour » pour ta vitrine",
  pakketVoet: "Uniquement pour les cafés déjà sélectionnés. Résiliable chaque mois.",
  aanbodNoot: "La formule café ne donne jamais une meilleure place dans la liste. Cela restera ainsi.",
  fietsTitel: "Que veut dire cycling-friendly ?",
  fietsUitleg: "Ces cafés ont un label dans l'app, et les cyclistes les cherchent. On s'y arrête facilement pendant une sortie.",
  t1: "Ton vélo peut rester en sécurité, de préférence en vue de la terrasse ou de la vitrine.",
  t2: "Tenue cycliste et chaussures à cales ne posent aucun problème.",
  t3: "On peut y remplir son bidon.",
  t4: "En plus : ouvert le week-end dès 8 h, une pompe ou quelques outils derrière le comptoir.",
  formTitel: "Inscris ton café",
  formUitleg: "Laisse tes coordonnées, je te recontacte dans quelques jours. Ton café est déjà sur la carte ? Tu peux aussi demander ici tes chiffres ou la formule café.",
  vBar: "Nom du café *",
  vGemeente: "Commune *",
  vNaam: "Ton nom *",
  vEmail: "Adresse e-mail *",
  vTelefoon: "Téléphone (facultatif)",
  vWaarvoor: "Pour quoi ?",
  kGratis: "Mention gratuite",
  kPakket: "Intéressé par la formule café",
  kVraag: "J'ai une question",
  vBericht: "Message (facultatif)",
  versturen: "Envoyer",
  privacyZin: "Nous utilisons tes données uniquement pour te contacter au sujet de Waypour.",
  privacyLink: "Politique de confidentialité",
  bedanktTitel: "Merci !",
  bedankt: "Ta demande est bien arrivée. Je te recontacte dans quelques jours."
};
// De meldingen in het Nederlands (de rest staat in de HTML)
const MELDINGEN_NL = {
  mVelden: "Vul de velden met een * in.",
  mEmail: "Dit e-mailadres lijkt niet juist.",
  mBezig: "Versturen…",
  mFout: "Versturen lukte niet. Probeer het later opnieuw of mail naar meertmilan@gmail.com."
};
Object.assign(FRANS, {
  mVelden: "Remplis les champs marqués d'un *.",
  mEmail: "Cette adresse e-mail ne semble pas correcte.",
  mBezig: "Envoi…",
  mFout: "L'envoi n'a pas fonctionné. Réessaie plus tard ou écris à meertmilan@gmail.com."
});

// De Nederlandse teksten onthouden zoals ze in de HTML staan
const NEDERLANDS = { ...MELDINGEN_NL };
document.querySelectorAll("[data-k]").forEach(el => { NEDERLANDS[el.dataset.k] = el.textContent; });

let paginaTaal = "nl";
function tekst(sleutel) {
  return (paginaTaal === "fr" ? FRANS : NEDERLANDS)[sleutel] || NEDERLANDS[sleutel] || "";
}

function zetTaal(nieuw) {
  paginaTaal = nieuw === "fr" ? "fr" : "nl";
  document.documentElement.lang = paginaTaal;
  document.title = paginaTaal === "fr" ? "Pour les cafés – Waypour" : "Voor koffiebars – Waypour";
  document.querySelectorAll("[data-k]").forEach(el => { el.textContent = tekst(el.dataset.k); });
  document.querySelectorAll('a[data-k="privacyLink"]').forEach(a => {
    a.href = paginaTaal === "fr" ? "privacy-en.html" : "privacy.html";   // geen Franse versie: de Engelse
  });
  document.querySelectorAll(".talen button").forEach(knop =>
    knop.classList.toggle("actief", knop.dataset.taal === paginaTaal));
  try { localStorage.setItem("taal", paginaTaal); } catch {}
}

document.querySelectorAll(".talen button").forEach(knop => { knop.onclick = () => zetTaal(knop.dataset.taal); });

// Welke taal eerst? ?taal=fr in de link, anders je vorige keuze, anders de taal van je toestel
(function () {
  const uitLink = new URLSearchParams(location.search).get("taal");
  let bewaard = null;
  try { bewaard = localStorage.getItem("taal"); } catch {}
  const toestel = (navigator.language || "nl").slice(0, 2);
  zetTaal(uitLink || bewaard || (toestel === "fr" ? "fr" : "nl"));
})();

// ---------- Het formulier ----------
const formulier = document.getElementById("aanvraag");
const melding = document.getElementById("formMelding");

formulier.onsubmit = async (event) => {
  event.preventDefault();
  const v = Object.fromEntries(new FormData(formulier).entries());
  for (const k of Object.keys(v)) v[k] = String(v[k]).trim();

  if (v.website) return;   // een spamrobot vulde het verborgen vakje in
  if (!v.bar || !v.gemeente || !v.naam || !v.email) { melding.textContent = tekst("mVelden"); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) { melding.textContent = tekst("mEmail"); return; }

  const knop = formulier.querySelector('button[type="submit"]');
  knop.disabled = true;
  melding.textContent = tekst("mBezig");
  try {
    await stuurBarAanvraag({
      bar: v.bar.slice(0, 100), gemeente: v.gemeente.slice(0, 100), naam: v.naam.slice(0, 80),
      email: v.email.slice(0, 200), telefoon: v.telefoon ? v.telefoon.slice(0, 40) : null,
      interesse: ["gratis", "pakket", "vraag"].includes(v.interesse) ? v.interesse : "gratis",
      bericht: v.bericht ? v.bericht.slice(0, 1000) : null,
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

// =====================================================
//  REVIEWS – sterren en een korte tekst per bar
// =====================================================

let alleReviews = [];        // alle reviews, geladen bij het starten
let openReviewsVan = null;   // de bar waarvan de reviews openstaan
let mijnVoornaam = "";       // komt uit je profiel, en staat bij je review

function reviewsVan(stopId) {
  return alleReviews.filter(r => r.stop_id === stopId);
}

function mijnReviewVan(stopId) {
  return gebruiker ? alleReviews.find(r => r.stop_id === stopId && r.user_id === gebruiker.id) : null;
}

// 4 → "★★★★☆"
function sterren(score) {
  return "★".repeat(score) + "☆".repeat(5 - score);
}

// De knop op het kaartje: "⭐ 4,3 (12)" of "⭐ Review geven"
function reviewKnopTekst(stop) {
  const lijst = reviewsVan(stop.id);
  if (lijst.length === 0) return "⭐ " + t("reviewGeven");
  const gemiddelde = lijst.reduce((som, r) => som + r.score, 0) / lijst.length;
  return "⭐ " + gemiddelde.toFixed(1).replace(".", ",") + " (" + lijst.length + ")";
}

// Het blok met alle reviews en je eigen formulier (alleen als het openstaat)
function reviewsBlokHTML(stop) {
  if (openReviewsVan !== stop.id) return "";
  const mijn = mijnReviewVan(stop.id);

  const lijst = reviewsVan(stop.id).map(r => `
    <li>
      <strong>${esc(r.voornaam || t("anoniem"))}</strong>
      <span class="sterren">${sterren(r.score)}</span>
      ${isBeheerder() && r.user_id !== gebruiker.id
        ? `<button class="wisReview" data-user="${r.user_id}">🗑️</button>` : ""}
      ${r.tekst ? `<p>${esc(r.tekst)}</p>` : ""}
    </li>`).join("");

  const formulier = gebruiker ? `
    <div class="reviewFormulier">
      <div class="kiesSterren">
        ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-score="${n}"
            class="${mijn && mijn.score >= n ? "aan" : ""}">★</button>`).join("")}
      </div>
      <textarea maxlength="500" placeholder="${t("reviewTekst")}">${mijn && mijn.tekst ? esc(mijn.tekst) : ""}</textarea>
      <div class="rij">
        <button type="button" class="bewaarReview">${mijn ? t("reviewAanpassen") : t("reviewPlaatsen")}</button>
        ${mijn ? `<button type="button" class="wisMijnReview">${t("reviewVerwijderen")}</button>` : ""}
      </div>
      <small class="reviewMelding"></small>
    </div>` : "";

  return `<div class="reviews">
    ${lijst ? `<ul>${lijst}</ul>` : `<p class="leeg">${t("nogGeenReviews")}</p>`}
    ${formulier}
  </div>`;
}

// De knoppen in het reviewblok laten werken
function koppelReviews(li, stop) {
  const knop = li.querySelector(".reviewKnop");
  knop.onclick = (event) => {
    event.stopPropagation();
    openReviewsVan = openReviewsVan === stop.id ? null : stop.id;
    teken();
  };

  const blok = li.querySelector(".reviews");
  if (!blok) return;
  blok.onclick = (event) => event.stopPropagation();   // klikken in het blok zoomt de kaart niet

  // Sterren kiezen
  const mijn = mijnReviewVan(stop.id);
  let gekozenScore = mijn ? mijn.score : 0;
  blok.querySelectorAll(".kiesSterren button").forEach(ster => {
    ster.onclick = () => {
      gekozenScore = Number(ster.dataset.score);
      blok.querySelectorAll(".kiesSterren button").forEach(s =>
        s.classList.toggle("aan", Number(s.dataset.score) <= gekozenScore));
    };
  });

  // Plaatsen of aanpassen
  const bewaar = blok.querySelector(".bewaarReview");
  if (bewaar) bewaar.onclick = async () => {
    const melding = blok.querySelector(".reviewMelding");
    if (gekozenScore === 0) { melding.textContent = t("kiesSterren"); return; }
    const tekst = blok.querySelector("textarea").value.trim();
    try {
      await bewaarReview(stop.id, gekozenScore, tekst, mijnVoornaam);
      alleReviews = alleReviews.filter(r => !(r.stop_id === stop.id && r.user_id === gebruiker.id));
      alleReviews.unshift({ stop_id: stop.id, user_id: gebruiker.id, score: gekozenScore,
                            tekst: tekst, voornaam: mijnVoornaam });
      teken();
    } catch (fout) {
      melding.textContent = t("opslaanMislukt") + " " + fout.message;
    }
  };

  // Je eigen review verwijderen
  const wisMijn = blok.querySelector(".wisMijnReview");
  if (wisMijn) wisMijn.onclick = async () => {
    await verwijderReview(stop.id, gebruiker.id);
    alleReviews = alleReviews.filter(r => !(r.stop_id === stop.id && r.user_id === gebruiker.id));
    teken();
  };

  // De beheerder kan ongepaste reviews verwijderen
  blok.querySelectorAll(".wisReview").forEach(w => {
    w.onclick = async () => {
      if (!confirm(t("zekerReview"))) return;
      await verwijderReview(stop.id, w.dataset.user);
      alleReviews = alleReviews.filter(r => !(r.stop_id === stop.id && r.user_id === w.dataset.user));
      teken();
    };
  });
}

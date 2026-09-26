// =====================================================
//  DICHTBIJ MIJ – je locatie en de afstand tot elke bar
// =====================================================

let mijnPlek = null;   // [breedte, lengte] zodra je op "Dichtbij mij" klikte

// De afstand in km tussen twee plekken op aarde (de "haversine"-formule)
function afstandKm(a, b) {
  const R = 6371;                                   // straal van de aarde in km
  const rad = graden => graden * Math.PI / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// "350 m" of "4,2 km"
function afstandTekst(stop) {
  if (!mijnPlek) return "";
  const km = afstandKm(mijnPlek, [stop.lat, stop.lng]);
  if (km < 1) return Math.round(km * 1000 / 10) * 10 + " m";
  return km.toFixed(1).replace(".", ",") + " km";
}

// Op de knop "📍 Dichtbij mij" klikken
function zoekMijnLocatie() {
  const knop = document.getElementById("dichtbijKnop");

  if (!navigator.geolocation) {
    alert(t("geenLocatie"));
    return;
  }

  knop.textContent = t("locatieZoeken");
  navigator.geolocation.getCurrentPosition(
    // Gelukt: we kennen je plek
    (positie) => {
      mijnPlek = [positie.coords.latitude, positie.coords.longitude];
      knop.textContent = t("dichtbij");
      knop.classList.add("actief");

      // Alle landen en steden tonen, en de lijst sorteren op afstand
      gekozenLand = "alles";
      gekozenStad = "alles";
      teken();

      // Inzoomen op jou en de 5 dichtstbijzijnde bars
      const dichtste = zichtbareStops()
        .sort((a, b) => afstandKm(mijnPlek, [a.lat, a.lng]) - afstandKm(mijnPlek, [b.lat, b.lng]))
        .slice(0, 5);
      const punten = [mijnPlek, ...dichtste.map(s => [s.lat, s.lng])];
      kaart.fitBounds(L.latLngBounds(punten), { padding: [40, 40], maxZoom: 15 });
    },
    // Mislukt: geweigerd, of geen signaal
    () => {
      knop.textContent = t("dichtbij");
      alert(t("locatieGeweigerd"));
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

document.getElementById("dichtbijKnop").onclick = zoekMijnLocatie;

// =====================================================
//  BARS VOORSTELLEN – gebruikers stellen voor, de beheerder keurt goed
// =====================================================

let voorstellen = [];               // alleen de beheerder ziet ze
let voorstelInBehandeling = null;   // het voorstel dat de beheerder net overnam

// ---------- Voor gebruikers: een bar voorstellen ----------
document.getElementById("voorstelKnop").onclick = () => {
  const formulier = document.getElementById("voorstelFormulier");
  formulier.hidden = !formulier.hidden;
};

document.getElementById("voorstelFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const melding = document.getElementById("voorstelMelding");
  try {
    await stuurVoorstel(
      document.getElementById("voorstelNaam").value.trim(),
      document.getElementById("voorstelAdres").value.trim(),
      document.getElementById("voorstelInfo").value.trim()
    );
    event.target.reset();
    melding.textContent = t("voorstelBedankt");
  } catch (fout) {
    melding.textContent = t("opslaanMislukt") + " " + fout.message;
  }
};

// ---------- Voor de beheerder: het overzicht ----------
async function laadVoorstellen() {
  const blok = document.getElementById("voorstellenBeheer");
  blok.hidden = !isBeheerder();
  if (!isBeheerder()) return;

  try {
    voorstellen = await haalVoorstellenOp();
  } catch (fout) {
    console.error(fout);
    voorstellen = [];
  }
  tekenVoorstellen();
}

function tekenVoorstellen() {
  const blok = document.getElementById("voorstellenBeheer");
  if (voorstellen.length === 0) {
    blok.innerHTML = `<strong>📬 ${t("voorstellen")}</strong><p class="leeg">${t("geenVoorstellen")}</p>`;
    return;
  }

  blok.innerHTML = `<strong>📬 ${t("voorstellen")} (${voorstellen.length})</strong>
    <ul>${voorstellen.map(v => `
      <li>
        <b>${esc(v.naam)}</b><br>
        <small>${esc(v.adres)}</small>
        ${v.info ? `<p>${esc(v.info)}</p>` : ""}
        <button type="button" data-overnemen="${v.id}">➕ ${t("overnemen")}</button>
        <button type="button" data-weigeren="${v.id}">🗑️ ${t("weigeren")}</button>
      </li>`).join("")}
    </ul>`;

  // Overnemen: het formulier "Nieuwe stop" invullen en het adres meteen opzoeken
  blok.querySelectorAll("[data-overnemen]").forEach(knop => {
    knop.onclick = () => {
      const v = voorstellen.find(x => x.id === knop.dataset.overnemen);
      voorstelInBehandeling = v.id;
      document.getElementById("nieuwNaam").value = v.naam;
      document.getElementById("nieuwAdres").value = v.adres;
      document.getElementById("nieuwInfo").value = v.info || "";
      document.getElementById("zoekAdresKnop").click();
      document.getElementById("formulier").scrollIntoView({ behavior: "smooth" });
    };
  });

  // Weigeren: het voorstel verwijderen
  blok.querySelectorAll("[data-weigeren]").forEach(knop => {
    knop.onclick = async () => {
      if (!confirm(t("zekerWeigeren"))) return;
      await verwijderVoorstel(knop.dataset.weigeren);
      voorstellen = voorstellen.filter(v => v.id !== knop.dataset.weigeren);
      tekenVoorstellen();
    };
  });
}

// Wordt aangeroepen nadat de beheerder een nieuwe bar bewaarde
async function voorstelAfgewerkt() {
  if (!voorstelInBehandeling) return;
  try {
    await verwijderVoorstel(voorstelInBehandeling);
    voorstellen = voorstellen.filter(v => v.id !== voorstelInBehandeling);
  } catch (fout) {
    console.error(fout);
  }
  voorstelInBehandeling = null;
  tekenVoorstellen();
}

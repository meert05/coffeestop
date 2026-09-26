// =====================================================
//  OPENINGSUREN – wanneer is een bar open?
// =====================================================
//
// In de database staat per bar een lijstje zoals:
//   { "ma": "08:00-17:00", "di": "08:00-17:00", …, "zo": "09:00-12:00, 14:00-18:00" }
// Een lege dag ("") betekent: gesloten. Geen lijstje (null) betekent: we weten het niet.

// De dagen in de volgorde van JavaScript: getDay() geeft 0 voor zondag, 1 voor maandag, …
const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
// De volgorde waarin we ze tonen: maandag eerst
const WEEK = ["ma", "di", "wo", "do", "vr", "za", "zo"];

// "08:00-12:00, 13:00-18:00" → [[480, 720], [780, 1080]]  (minuten na middernacht)
// Werkt ook met "8-17", "8u-17u" of "08.00-17.00"
function leesUren(tekst) {
  if (!tekst) return [];
  const blokken = [];
  for (const deel of tekst.split(",")) {
    const match = deel.trim().match(/^(\d{1,2})(?:[:.u](\d{2}))?u?\s*-\s*(\d{1,2})(?:[:.u](\d{2}))?u?$/);
    if (!match) continue;
    const van = Number(match[1]) * 60 + Number(match[2] || 0);
    let tot = Number(match[3]) * 60 + Number(match[4] || 0);
    if (tot <= van) tot += 24 * 60;   // bv. 18:00-01:00: sluit na middernacht
    blokken.push([van, tot]);
  }
  return blokken;
}

// 480 → "08:00"
function klok(minuten) {
  const m = minuten % (24 * 60);
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

function heeftUren(stop) {
  return stop.openingsuren && typeof stop.openingsuren === "object";
}

// Is de bar nu open? Geeft null als we het niet weten.
function openStatus(stop, nu = new Date()) {
  if (!heeftUren(stop)) return null;
  const minutenNu = nu.getHours() * 60 + nu.getMinutes();
  const vandaag = DAGEN[nu.getDay()];
  const gisteren = DAGEN[(nu.getDay() + 6) % 7];

  // Open volgens de uren van vandaag?
  for (const [van, tot] of leesUren(stop.openingsuren[vandaag])) {
    if (minutenNu >= van && minutenNu < tot) return { open: true, tot: klok(tot) };
  }
  // Nog open van gisteren (na middernacht)?
  for (const [van, tot] of leesUren(stop.openingsuren[gisteren])) {
    if (tot > 24 * 60 && minutenNu < tot - 24 * 60) return { open: true, tot: klok(tot) };
  }

  // Gesloten: wanneer gaat de bar weer open? We kijken tot 7 dagen vooruit.
  for (let extra = 0; extra < 7; extra++) {
    const dag = DAGEN[(nu.getDay() + extra) % 7];
    for (const [van] of leesUren(stop.openingsuren[dag])) {
      if (extra > 0 || van > minutenNu) {
        const wanneer = extra === 0 ? "" : extra === 1 ? t("morgen") + " " : t("dag_" + dag) + " ";
        return { open: false, opent: wanneer + klok(van) };
      }
    }
  }
  return { open: false, opent: null };
}

function isNuOpen(stop) {
  const status = openStatus(stop);
  return status !== null && status.open;
}

// Open op zondag vóór 9 uur? Handig voor een vroege zondagsrit.
function zondagVroegOpen(stop) {
  if (!heeftUren(stop)) return false;
  return leesUren(stop.openingsuren.zo).some(([van]) => van <= 9 * 60);
}

// De regel op het kaartje van de bar, met daaronder alle uren van de week
function openingsurenHTML(stop) {
  const status = openStatus(stop);
  if (status === null) return "";

  const kop = status.open
    ? `🟢 ${t("nuOpen")} · ${t("tot")} ${status.tot}`
    : `🔴 ${t("gesloten")}${status.opent ? " · " + t("opent") + " " + status.opent : ""}`;

  const vandaag = DAGEN[new Date().getDay()];
  const week = WEEK.map(dag => `
    <li class="${dag === vandaag ? "vandaag" : ""}">
      <span>${t("dag_" + dag)}</span>
      <span>${stop.openingsuren[dag] ? esc(stop.openingsuren[dag]) : t("gesloten")}</span>
    </li>`).join("");

  return `<details class="uren"><summary>${kop}</summary><ul>${week}</ul></details>`;
}

// De invulvakjes voor de beheerder (in het paneel "✏️ Aanpassen")
function urenBewerkenHTML(stop) {
  const uren = heeftUren(stop) ? stop.openingsuren : {};
  return `
    <div class="urenBewerken">
      <strong>🕐 ${t("openingsuren")}</strong>
      ${WEEK.map(dag => `
        <label>${t("dag_" + dag)}
          <input data-dag="${dag}" value="${esc(uren[dag] || "")}" placeholder="08:00-17:00">
        </label>`).join("")}
      <small>${t("urenUitleg")}</small>
      <button type="button" class="bewaarUren">${t("bewaarUren")}</button>
    </div>`;
}

// De ingevulde uren lezen en bewaren
async function bewaarUrenVan(stop, paneel) {
  const uren = {};
  paneel.querySelectorAll("input[data-dag]").forEach(vak => {
    uren[vak.dataset.dag] = vak.value.trim();
  });
  // Alles leeg? Dan weten we het niet (null), in plaats van "elke dag gesloten"
  const nieuw = Object.values(uren).some(u => u !== "") ? uren : null;
  await werkStopBij(stop.id, { openingsuren: nieuw });
  stop.openingsuren = nieuw;
}

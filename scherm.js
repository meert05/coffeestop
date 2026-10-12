// =====================================================
//  WAYPOUR – het scherm: kaart, schuifpaneel en bar-scherm
// =====================================================
// * Computer: de lijst links, de kaart rechts, allebei zo hoog als het scherm.
// * Gsm: de kaart over het hele scherm, de lijst als paneel dat je omhoog en omlaag schuift.
//   Het paneel heeft 3 standen: "mini" (alleen het kopje), "half" en "vol".
// * Klik op een bar (in de lijst of op de kaart): het bar-scherm met grote foto en twee hoofdknoppen.

const gsmScherm = window.matchMedia("(max-width: 860px)");
const lijstVak = document.getElementById("lijstVak");
const lijstKop = document.getElementById("lijstKop");
const wortel = document.documentElement;

let velStand = "half";          // stand van het paneel op een gsm
let velVoorBar = "half";        // de stand voor je een bar opende
let lijstScroll = 0;            // waar je in de lijst was voor je een bar opende
let barWasOpen = false;

function appZichtbaar() {
  return !document.getElementById("app").hidden;
}

// ---------- Hoe hoog is alles? ----------

// De kaart en het paneel beginnen onder de zoekbalk
function bovenPx() {
  return parseFloat(getComputedStyle(wortel).getPropertyValue("--boven")) || 0;
}
function meetBoven() {
  if (!appZichtbaar()) return;
  const boven = gsmScherm.matches
    ? document.getElementById("filters").getBoundingClientRect().bottom + 10
    : document.querySelector("#app main").getBoundingClientRect().top + window.scrollY;
  wortel.style.setProperty("--boven", Math.round(boven) + "px");
  zetVel(velStand, false);
  kaart.invalidateSize();
}

// De 3 standen van het paneel, in pixels
function velHoogtes() {
  const vrij = Math.max(200, window.innerHeight - bovenPx());
  return { mini: 92, half: Math.round(vrij * 0.46), vol: vrij };
}

// Hoeveel van de kaart is onderaan bedekt door het paneel? (0 op een computer)
function kaartOnder() {
  if (!gsmScherm.matches || !appZichtbaar()) return 0;
  return Math.min(velHoogtes()[velStand], Math.round((window.innerHeight - bovenPx()) * 0.7));
}

// ---------- Het paneel op een gsm ----------
function zetVel(stand, animeren = true) {
  velStand = stand;
  lijstVak.dataset.stand = stand;
  if (!gsmScherm.matches) {
    wortel.style.removeProperty("--vel");
    return;
  }
  wortel.classList.toggle("geenAnimatie", !animeren);
  wortel.style.setProperty("--vel", velHoogtes()[stand] + "px");
}

// Slepen aan het kopje (of erop tikken)
let sleep = null;
lijstKop.addEventListener("pointerdown", (event) => {
  if (!gsmScherm.matches || event.target.closest("button")) return;
  sleep = { y: event.clientY, h: lijstVak.getBoundingClientRect().height, tijd: Date.now(), bewogen: false };
  lijstKop.setPointerCapture(event.pointerId);
  wortel.classList.add("sleept");
});
lijstKop.addEventListener("pointermove", (event) => {
  if (!sleep) return;
  const dy = event.clientY - sleep.y;
  if (Math.abs(dy) > 6) sleep.bewogen = true;
  const hoogtes = velHoogtes();
  const h = Math.max(hoogtes.mini - 20, Math.min(hoogtes.vol, sleep.h - dy));
  wortel.style.setProperty("--vel", h + "px");
});
function stopSlepen(event) {
  if (!sleep) return;
  wortel.classList.remove("sleept");
  const hoogtes = velHoogtes();
  const nu = lijstVak.getBoundingClientRect().height;
  const snelheid = (event.clientY - sleep.y) / Math.max(1, Date.now() - sleep.tijd);   // + = omlaag
  let stand;
  if (!sleep.bewogen) stand = velStand === "half" ? "vol" : "half";       // tikken: groter of kleiner
  else if (snelheid > 0.4) stand = nu > hoogtes.half ? "half" : "mini";    // snel omlaag geveegd
  else if (snelheid < -0.4) stand = nu < hoogtes.half ? "half" : "vol";    // snel omhoog geveegd
  else stand = Object.keys(hoogtes).sort((a, b) => Math.abs(hoogtes[a] - nu) - Math.abs(hoogtes[b] - nu))[0];
  sleep = null;
  zetVel(stand);
}
lijstKop.addEventListener("pointerup", stopSlepen);
lijstKop.addEventListener("pointercancel", stopSlepen);

// Je scrolt in de lijst? Dan wordt het paneel groot. En we onthouden waar je was.
lijstVak.addEventListener("scroll", () => {
  if (!document.body.classList.contains("barOpen")) lijstScroll = lijstVak.scrollTop;
  if (gsmScherm.matches && velStand !== "vol" && !sleep && lijstVak.scrollTop > 10) zetVel("vol");
}, { passive: true });

// ---------- De kaart: rekening houden met het paneel ----------

// Een plek in het midden van het zichtbare stuk kaart zetten (boven het paneel)
function centreerOp(plek, zoom) {
  const punt = kaart.project(plek, zoom).add([0, kaartOnder() / 2]);
  kaart.setView(kaart.unproject(punt, zoom), zoom);
}

// Inzoomen op een groep bars: het stuk onder het paneel niet meetellen
const gewoneFitBounds = kaart.fitBounds.bind(kaart);
kaart.fitBounds = function (grenzen, opties = {}) {
  const onder = kaartOnder();
  if (!onder) return gewoneFitBounds(grenzen, opties);
  const rand = L.point(opties.padding || [0, 0]);
  const { padding, ...rest } = opties;
  return gewoneFitBounds(grenzen, {
    ...rest,
    paddingTopLeft: opties.paddingTopLeft || rand,
    paddingBottomRight: L.point(opties.paddingBottomRight || rand).add([0, onder])
  });
};

// Tik op de kaart (gsm, geen route): het paneel wordt klein, of het bar-scherm sluit
kaart.on("click", () => {
  if ((typeof routeModus !== "undefined" && routeModus) || inBeheer()) return;
  if (document.body.classList.contains("barOpen")) sluitBar();
  else if (gsmScherm.matches && velStand !== "mini") zetVel("mini");
});

// ---------- Het bar-scherm ----------

// Opgeroepen na elke keer dat de lijst getekend is (app.js)
function zetBarScherm() {
  const open = Boolean(document.querySelector("#lijst > li.gekozen"));
  if (open && !barWasOpen) velVoorBar = velStand;
  barWasOpen = open;
  document.body.classList.toggle("barOpen", open);
  document.getElementById("terugNaarLijst").hidden = !open;
}

// Opgeroepen door kies() in app.js, na een klik op een bar
function barGeopend(bron) {
  if (!document.body.classList.contains("barOpen")) return;
  lijstVak.scrollTop = 0;
  if (gsmScherm.matches) {
    zetVel(bron === "kaart" ? "half" : "vol");
    const stop = alleStops.find(s => s.id === gekozenStop);
    if (stop) centreerOp([stop.lat, stop.lng], kaart.getZoom());
  }
}

// Terug naar de lijst
function sluitBar() {
  if (gekozenStop === null) return;
  gekozenStop = null;
  if (typeof openReviewsVan !== "undefined") openReviewsVan = null;
  bewerkKenmerkenVan = null;
  teken();
  lijstVak.scrollTop = lijstScroll;
  if (gsmScherm.matches) zetVel(velVoorBar);
}
document.getElementById("terugNaarLijst").onclick = sluitBar;

// Escape: het bar-scherm sluiten (als er geen venster openstaat)
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !document.body.classList.contains("barOpen")) return;
  if (document.querySelector("dialog[open]")) return;
  if (event.target.closest && event.target.closest("input, textarea, select")) return;
  sluitBar();
});

// Route plannen aangezet (route.js): de lijst toont het routepaneel
function naarRoutePaneel() {
  sluitBar();
  lijstVak.scrollTop = 0;
  if (gsmScherm.matches) zetVel("half");
}

// ---------- Ronde knop "mijn locatie" op de kaart ----------
document.getElementById("locatieKnop").onclick = () => {
  if (mijnPlek) centreerOp(mijnPlek, Math.max(kaart.getZoom(), 14));
  else zoekMijnLocatie();
};

// ---------- Meten: bij het starten, bij draaien van de gsm, als de app verschijnt ----------
window.addEventListener("resize", meetBoven);
gsmScherm.addEventListener("change", () => { zetVel(velStand, false); meetBoven(); });
if ("ResizeObserver" in window) {
  new ResizeObserver(meetBoven).observe(document.getElementById("filters"));
}
new MutationObserver(() => setTimeout(meetBoven, 0))
  .observe(document.getElementById("app"), { attributes: true, attributeFilter: ["hidden"] });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(meetBoven);
meetBoven();
zetBarScherm();

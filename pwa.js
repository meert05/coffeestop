// =====================================================
//  WAYPOUR – als app op je beginscherm zetten
// =====================================================

// 1. De service worker aanzetten (nodig om de site te kunnen installeren)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  });
}

// 2. Een balkje onderaan op de gsm: "Zet Waypour op je beginscherm"
const alsApp = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIphone = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
                 (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installVraag = null;   // Android/Chrome: de echte installatievraag van de browser

function balkWeggeklikt() {
  try { return localStorage.getItem("installBalkWeg") === "1"; } catch { return false; }
}

function toonInstallBalk(soort) {
  const balk = document.getElementById("installBalk");
  if (!balk || alsApp || balkWeggeklikt()) return;
  if (!window.matchMedia("(max-width: 900px)").matches) return;   // alleen op gsm en tablet
  balk.dataset.soort = soort;                                       // "android" of "iphone"
  tekenInstallBalk();
  balk.hidden = false;
}

function tekenInstallBalk() {
  const balk = document.getElementById("installBalk");
  if (!balk || !balk.dataset.soort) return;
  balk.querySelector(".tekst").textContent =
    balk.dataset.soort === "iphone" ? t("installIphone") : t("installTekst");
  const knop = balk.querySelector(".installeer");
  knop.hidden = balk.dataset.soort !== "android";
  knop.textContent = t("installKnop");
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();       // niet meteen tonen: wij tonen ons eigen balkje
  installVraag = event;
  toonInstallBalk("android");
});

window.addEventListener("appinstalled", () => {
  const balk = document.getElementById("installBalk");
  if (balk) balk.hidden = true;
});

document.addEventListener("DOMContentLoaded", () => {
  const balk = document.getElementById("installBalk");
  if (!balk) return;
  balk.querySelector(".installeer").onclick = async () => {
    if (!installVraag) return;
    installVraag.prompt();
    await installVraag.userChoice;
    installVraag = null;
    balk.hidden = true;
  };
  balk.querySelector(".sluiten").onclick = () => {
    balk.hidden = true;
    try { localStorage.setItem("installBalkWeg", "1"); } catch {}
  };
  // iPhone heeft geen installatieknop: daar tonen we de uitleg (Deel → Zet op beginscherm)
  if (isIphone) setTimeout(() => toonInstallBalk("iphone"), 4000);
});

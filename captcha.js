// =====================================================
//  BESCHERMING TEGEN BOTS – Cloudflare Turnstile
// =====================================================
//
// Een onzichtbare controle bij aanmelden, inloggen en "wachtwoord vergeten".
// Zo kan een computerprogramma niet duizenden wachtwoorden proberen of
// nep-accounts aanmaken. Echte mensen merken er (bijna) niets van.
//
// Zolang hieronder geen Site Key staat, staat de controle uit.
// De Site Key is openbaar en mag in de code; de SECRET key hoort alleen in Supabase!

const TURNSTILE_SITE_KEY = "0x4AAAAAAFK3nYBdMHU2i6wj";   // ← plak hier je Site Key van Cloudflare, tussen de aanhalingstekens

let captchaWidget = null;
let captchaVraagtKlik = false;     // toont Cloudflare het vakje "ik ben geen robot"?
let captchaFoutCode = null;        // foutcode van Cloudflare (om te helpen zoeken)

function captchaAan() {
  return TURNSTILE_SITE_KEY !== "";
}

function captchaMelding(tekst, metKnop = false) {
  const bericht = document.getElementById("loginBericht");
  bericht.innerHTML = "";
  bericht.append(tekst);
  if (metKnop) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "link";
    knop.textContent = t("bijvulOpnieuw");          // "Opnieuw proberen"
    knop.onclick = () => { captchaFoutCode = null; bericht.textContent = ""; resetCaptcha(); };
    bericht.append(" ", knop);
  }
}

// De controle van Cloudflare inladen en (meestal onzichtbaar) klaarzetten
if (captchaAan()) {
  window.captchaKlaar = () => {
    // Wacht tot de pagina (en de vertalingen) volledig geladen is
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", window.captchaKlaar);
      return;
    }
    captchaWidget = turnstile.render("#captcha", {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      size: "flexible",
      appearance: "interaction-only",   // alleen zichtbaar als Cloudflare twijfelt
      language: typeof taal !== "undefined" ? taal : "auto",
      "refresh-expired": "auto",
      // Cloudflare twijfelt: het vakje verschijnt. Dat moet je dan ook zien!
      "before-interactive-callback": () => {
        captchaVraagtKlik = true;
        captchaMelding(t("captchaKlik"));
        document.getElementById("captcha").scrollIntoView({ behavior: "smooth", block: "center" });
      },
      "after-interactive-callback": () => {
        captchaVraagtKlik = false;
        document.getElementById("loginBericht").textContent = "";
      },
      callback: () => { captchaFoutCode = null; },
      "error-callback": (code) => {
        captchaFoutCode = code;
        console.warn("Turnstile-fout", code);
        captchaMelding(t("captchaProbleem") + " (" + code + ")", true);
        return true;                     // wij tonen zelf de melding
      },
      "unsupported-callback": () => { captchaMelding(t("captchaNietOndersteund")); }
    });
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=captchaKlaar";
  script.async = true;
  // Kon het script niet laden (bv. door een adblocker)? Melden zodra de pagina klaar is
  const meldNietGeladen = () => captchaMelding(t("captchaGeladen"));
  script.onerror = () => (document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", meldNietGeladen)
    : meldNietGeladen());
  document.head.appendChild(script);
}

// Het bewijs ("token") dat je geen robot bent.
// Meestal is het er meteen. Moet je eerst het vakje aanklikken, dan wachten we tot 2 minuten.
async function haalCaptchaToken() {
  if (!captchaAan()) return undefined;
  const start = Date.now();
  let gemeld = false;
  while (true) {
    const token = captchaWidget !== null && window.turnstile ? turnstile.getResponse(captchaWidget) : "";
    if (token) {
      if (gemeld) document.getElementById("loginBericht").textContent = "";
      return token;
    }
    const wachttijd = Date.now() - start;
    if (captchaFoutCode) throw captchaFout(t("captchaProbleem") + " (" + captchaFoutCode + ")");
    if (wachttijd > (captchaVraagtKlik ? 120000 : 20000)) throw captchaFout(t("captchaFout"));
    if (captchaVraagtKlik && gemeld !== "klik") {        // het vakje staat er: zeg het en toon het
      captchaMelding(t("captchaKlik"));
      document.getElementById("captcha").scrollIntoView({ behavior: "smooth", block: "center" });
      gemeld = "klik";
    } else if (!gemeld && wachttijd > 700) {
      captchaMelding(t("captchaWacht"));
      gemeld = "wacht";
    }
    await new Promise(klaar => setTimeout(klaar, 250));
  }
}

// Een fout van de controle: melding met knop "Opnieuw proberen" (app.js overschrijft die niet)
function captchaFout(tekst) {
  captchaMelding(tekst, true);
  const fout = new Error(tekst);
  fout.captcha = true;
  return fout;
}

// Een bewijs werkt maar één keer: na elke poging vragen we een nieuw
function resetCaptcha() {
  if (captchaWidget !== null && window.turnstile) {
    captchaVraagtKlik = false;
    turnstile.reset(captchaWidget);
  }
}

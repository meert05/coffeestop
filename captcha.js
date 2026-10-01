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

const TURNSTILE_SITE_KEY = "";   // ← plak hier je Site Key van Cloudflare, tussen de aanhalingstekens

let captchaWidget = null;

function captchaAan() {
  return TURNSTILE_SITE_KEY !== "";
}

// De controle van Cloudflare inladen en (onzichtbaar) klaarzetten
if (captchaAan()) {
  window.captchaKlaar = () => {
    captchaWidget = turnstile.render("#captcha", {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "dark",
      size: "flexible",
      appearance: "interaction-only",   // alleen zichtbaar als Cloudflare twijfelt
      language: taal
    });
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=captchaKlaar";
  script.async = true;
  document.head.appendChild(script);
}

// Het bewijs ("token") dat je geen robot bent. We wachten hooguit 10 seconden.
async function haalCaptchaToken() {
  if (!captchaAan()) return undefined;
  const bericht = document.getElementById("loginBericht");
  for (let poging = 0; poging < 40; poging++) {
    const token = captchaWidget !== null && window.turnstile ? turnstile.getResponse(captchaWidget) : "";
    if (token) return token;
    if (poging === 2) bericht.textContent = t("captchaWacht");
    await new Promise(klaar => setTimeout(klaar, 250));
  }
  throw new Error(t("captchaFout"));
}

// Een bewijs werkt maar één keer: na elke poging vragen we een nieuw
function resetCaptcha() {
  if (captchaWidget !== null && window.turnstile) turnstile.reset(captchaWidget);
}

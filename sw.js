// =====================================================
//  WAYPOUR – service worker (maakt de site installeerbaar als app)
// =====================================================
// Werkt "netwerk eerst": je krijgt altijd de nieuwste versie van de site.
// Alleen zonder internet vallen we terug op de laatst bewaarde bestanden.
// Gegevens van de database, kaarten en routes gaan altijd rechtstreeks naar het internet.

const CACHE = "waypour-v2";
const BASIS = [
  "./", "index.html", "style.css", "manifest.webmanifest",
  "database.js", "captcha.js", "vertalingen.js", "locatie.js", "openingsuren.js", "reviews.js",
  "voorstellen.js", "app.js", "route.js", "bijvullen.js", "profiel.js", "vrienden.js", "import.js", "pwa.js",
  "stops.json", "iconen/icoon-192.png", "iconen/icoon-512.png", "iconen/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(BASIS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Oude versies van de cache opruimen
  event.waitUntil(
    caches.keys().then(namen => Promise.all(namen.filter(n => n !== CACHE).map(n => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const vraag = event.request;
  // Alleen eigen bestanden (geen database, kaarten of andere websites), en alleen lezen
  if (vraag.method !== "GET" || new URL(vraag.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(vraag)
      .then(antwoord => {
        if (antwoord.ok) {
          const kopie = antwoord.clone();
          caches.open(CACHE).then(cache => cache.put(vraag, kopie));
        }
        return antwoord;
      })
      .catch(() => caches.match(vraag, { ignoreSearch: true })
        .then(bewaard => bewaard || caches.match("index.html")))
  );
});

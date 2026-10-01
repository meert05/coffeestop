// =====================================================
//  DATABASE – de verbinding met Supabase
// =====================================================

// Jouw project. Deze twee mogen gewoon in je website staan:
// de beveiligingsregels in Supabase bepalen wie wat mag.
const SUPABASE_URL = "https://ydowujqenhmppwgsapyi.supabase.co";
const SUPABASE_KEY = "sb_publishable_I1g2phao5BVP9tj8FmJ7Ag_apjdjLB3";

// Het e-mailadres van de beheerder (jij). Moet hetzelfde zijn als in je SQL-regels.
const BEHEERDER = "meertmilan@gmail.com";

// De verbinding maken
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Wie is er ingelogd? null = niemand
let gebruiker = null;

function isBeheerder() {
  return gebruiker !== null && gebruiker.email === BEHEERDER;
}

// ---------- Stops ----------
async function haalStopsOp() {
  const { data, error } = await db.from("stops").select("*").order("naam");
  if (error) throw error;
  return data;
}

async function voegStopToeInDatabase(stop) {
  const { error } = await db.from("stops").insert(stop);
  if (error) throw error;
}

async function verwijderStopUitDatabase(id) {
  const { error } = await db.from("stops").delete().eq("id", id);
  if (error) throw error;
}

// Eén of meer velden van een bar aanpassen, bv. werkStopBij("bar-bidon", { type: "both" })
async function werkStopBij(stopId, velden) {
  const { error } = await db.from("stops").update(velden).eq("id", stopId);
  if (error) throw error;
}

async function zetKenmerken(stopId, kenmerken) {
  const { error } = await db.from("stops").update({ kenmerken: kenmerken }).eq("id", stopId);
  if (error) throw error;
}

// ---------- Foto's (Supabase Storage) ----------
async function uploadFoto(bestand, stopId) {
  // Elke upload krijgt een unieke naam, bv. "bar-bidon-1727350000000.jpg"
  const pad = stopId + "-" + Date.now() + ".jpg";
  const { error } = await db.storage.from("fotos")
    .upload(pad, bestand, { contentType: "image/jpeg" });
  if (error) throw error;
  // De openbare link naar de foto teruggeven
  return db.storage.from("fotos").getPublicUrl(pad).data.publicUrl;
}

async function zetFotoVanStop(stopId, url) {
  const { error } = await db.from("stops").update({ foto: url }).eq("id", stopId);
  if (error) throw error;
}

// ---------- Favorieten ----------
async function haalFavorietenOp() {
  const { data, error } = await db.from("favorieten").select("stop_id");
  if (error) throw error;
  return data.map(rij => rij.stop_id);   // alleen de id's
}

async function bewaarFavoriet(stopId, aan) {
  const { error } = aan
    ? await db.from("favorieten").insert({ stop_id: stopId })
    : await db.from("favorieten").delete().eq("stop_id", stopId);
  if (error) throw error;
}

// ---------- Inloggen met e-mail en wachtwoord ----------
// Waar de links in de mails (bevestigen, wachtwoord resetten) naartoe gaan
const TERUG_NAAR = location.origin + location.pathname;

async function maakAccount(email, wachtwoord, voornaam, nieuwsbrief, gebruik, captchaToken) {
  const { data, error } = await db.auth.signUp({
    email: email,
    password: wachtwoord,
    options: {
      emailRedirectTo: TERUG_NAAR,
      captchaToken: captchaToken,     // bewijs dat je geen robot bent (captcha.js)
      // Extra info bij het account, zodat we ze later in het profiel kunnen zetten
      data: { voornaam: voornaam, nieuwsbrief: nieuwsbrief, gebruik: gebruik }
    }
  });
  if (error) throw error;
  return data.session !== null;   // true = meteen ingelogd, false = eerst mail bevestigen
}

async function logIn(email, wachtwoord, captchaToken) {
  const { error } = await db.auth.signInWithPassword({
    email: email, password: wachtwoord, options: { captchaToken: captchaToken }
  });
  if (error) throw error;
}

async function stuurWachtwoordReset(email, captchaToken) {
  // "?wachtwoord=nieuw" achter de link: zo weet de app dat je een nieuw wachtwoord komt kiezen
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: TERUG_NAAR + "?wachtwoord=nieuw",
    captchaToken: captchaToken
  });
  if (error) throw error;
}

async function kiesNieuwWachtwoord(wachtwoord) {
  const { error } = await db.auth.updateUser({ password: wachtwoord });
  if (error) throw error;
}

async function logUit() {
  await db.auth.signOut();
}

// ---------- Profielen (voornaam en nieuwsbrief) ----------
async function haalProfielOp() {
  const { data, error } = await db.from("profielen")
    .select("*").eq("id", gebruiker.id).maybeSingle();
  if (error) throw error;
  return data;   // null als er nog geen profiel is
}

async function bewaarProfiel(velden) {
  // upsert = aanmaken als het nog niet bestaat, anders bijwerken
  const { error } = await db.from("profielen")
    .upsert({ id: gebruiker.id, email: gebruiker.email, ...velden });
  if (error) throw error;
}

// ---------- Reviews ----------
async function haalReviewsOp() {
  const { data, error } = await db.from("reviews")
    .select("stop_id, user_id, score, tekst, voornaam, foto, gemaakt_op")
    .order("gemaakt_op", { ascending: false });
  if (error) throw error;
  return data;
}

async function bewaarReview(stopId, score, tekst, voornaam, foto) {
  // upsert: een nieuwe review, of je bestaande review voor deze bar bijwerken
  const { error } = await db.from("reviews").upsert({
    stop_id: stopId, user_id: gebruiker.id, score: score, tekst: tekst, voornaam: voornaam, foto: foto || null
  });
  if (error) throw error;
}

async function verwijderReview(stopId, userId) {
  const { error } = await db.from("reviews").delete().eq("stop_id", stopId).eq("user_id", userId);
  if (error) throw error;
}

// ---------- Bars voorstellen ----------
async function stuurVoorstel(naam, adres, info) {
  const { error } = await db.from("voorstellen").insert({ naam: naam, adres: adres, info: info });
  if (error) throw error;
}

async function haalVoorstellenOp() {
  const { data, error } = await db.from("voorstellen").select("*").order("gemaakt_op");
  if (error) throw error;
  return data;
}

async function verwijderVoorstel(id) {
  const { error } = await db.from("voorstellen").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Account verwijderen ----------
// Roept de functie "verwijder_mijn_account" in de database aan (zie SQL)
async function verwijderMijnAccount() {
  const { error } = await db.rpc("verwijder_mijn_account");
  if (error) throw error;
}

// ---------- Bewaarde routes ----------
// Mijn eigen routes (niet de gepubliceerde routes van anderen)
async function haalRoutesOp() {
  const { data, error } = await db.from("routes")
    .select("*").eq("user_id", gebruiker.id).order("gemaakt_op", { ascending: false });
  if (error) throw error;
  return data;
}

// De routes die de beheerder publiceerde: iedereen ziet ze
async function haalPubliekeRoutesOp() {
  const { data, error } = await db.from("routes")
    .select("*").eq("publiek", true).order("gemaakt_op", { ascending: false });
  if (error) throw error;
  return data;
}

// Eén route (voor een gedeelde link naar een gepubliceerde route)
async function haalRouteOp(id) {
  const { data, error } = await db.from("routes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

async function bewaarRouteInDatabase(route) {
  const { data, error } = await db.from("routes").insert(route).select();
  if (error) throw error;
  return data && data[0];   // de bewaarde route, met haar id
}

async function verwijderRouteUitDatabase(id) {
  const { error } = await db.from("routes").delete().eq("id", id);
  if (error) throw error;
}

// Alleen de beheerder: een route publiceren (of weer privé maken)
async function zetRoutePubliek(id, publiek) {
  const { error } = await db.from("routes").update({ publiek: publiek }).eq("id", id);
  if (error) throw error;
}

// ---------- Profielfoto (in de map "avatars/<jouw id>/") ----------
async function uploadProfielfoto(bestand) {
  const pad = gebruiker.id + "/avatar-" + Date.now() + ".jpg";
  const { error } = await db.storage.from("avatars").upload(pad, bestand, { contentType: "image/jpeg" });
  if (error) throw error;
  // Oudere foto's opruimen: we bewaren er maar één
  await verwijderMijnProfielfotos(pad);
  return db.storage.from("avatars").getPublicUrl(pad).data.publicUrl;
}

// Al je profielfoto's wissen (behalve eventueel de foto die je wil houden)
async function verwijderMijnProfielfotos(behalve = null) {
  const { data, error } = await db.storage.from("avatars").list(gebruiker.id);
  if (error) throw error;
  const weg = (data || []).map(f => gebruiker.id + "/" + f.name).filter(pad => pad !== behalve);
  if (weg.length) {
    const { error: fout } = await db.storage.from("avatars").remove(weg);
    if (fout) throw fout;
  }
}

// Je naam of foto ook aanpassen bij al je reviews
async function werkMijnReviewsBij(velden) {
  const { error } = await db.from("reviews").update(velden).eq("user_id", gebruiker.id);
  if (error) throw error;
}

// ---------- Eigen bijvulpunten (alleen de beheerder voegt toe) ----------
async function haalBijvulpuntenOp() {
  const { data, error } = await db.from("bijvulpunten").select("*");
  if (error) throw error;
  return data || [];
}

async function bewaarBijvulpunt(punt) {
  const { data, error } = await db.from("bijvulpunten").insert(punt).select().single();
  if (error) throw error;
  return data;
}

async function verwijderBijvulpunt(id) {
  const { error } = await db.from("bijvulpunten").delete().eq("id", id);
  if (error) throw error;
}

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

async function maakAccount(email, wachtwoord, voornaam, nieuwsbrief) {
  const { data, error } = await db.auth.signUp({
    email: email,
    password: wachtwoord,
    options: {
      emailRedirectTo: TERUG_NAAR,
      // Extra info bij het account, zodat we ze later in het profiel kunnen zetten
      data: { voornaam: voornaam, nieuwsbrief: nieuwsbrief }
    }
  });
  if (error) throw error;
  return data.session !== null;   // true = meteen ingelogd, false = eerst mail bevestigen
}

async function logIn(email, wachtwoord) {
  const { error } = await db.auth.signInWithPassword({ email: email, password: wachtwoord });
  if (error) throw error;
}

async function stuurWachtwoordReset(email) {
  // "?wachtwoord=nieuw" achter de link: zo weet de app dat je een nieuw wachtwoord komt kiezen
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: TERUG_NAAR + "?wachtwoord=nieuw"
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

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

// ---------- Inloggen ----------
async function stuurInloglink(email) {
  const { error } = await db.auth.signInWithOtp({
    email: email,
    // Na het klikken op de link in je mail kom je terug op deze pagina
    options: { emailRedirectTo: location.origin + location.pathname }
  });
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

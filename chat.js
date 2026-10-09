// =====================================================
//  WAYPOUR – berichten: chatten met je vrienden
// =====================================================
// * Tabblad "Berichten" in Samen rijden: je gesprekken, met het laatste bericht en ongelezen berichten.
// * Klik op een gesprek (of op 💬 bij een vriend) om te chatten.
// * Nieuwe berichten komen meteen binnen (Supabase Realtime); anders kijken we om de 15 seconden.

let gesprekken = [];      // [{ id, voornaam, foto, gebruikersnaam, laatste, verzonden, van_mij, ongelezen }]
let chatMet = null;       // de vriend met wie je nu chat
let chatLijst = [];       // de berichten van dat gesprek
let chatKanaal = null;    // live verbinding
let chatTimer = null;

function ongelezenBerichten() {
  return gesprekken.reduce((som, g) => som + (g.ongelezen || 0), 0);
}

// Na het inloggen en uitloggen (opgeroepen door vrienden.js)
async function chatNaInloggen() {
  if (!gebruiker) {
    gesprekken = [];
    chatMet = null;
    if (chatKanaal && db.removeChannel) db.removeChannel(chatKanaal);
    chatKanaal = null;
    const venster = document.getElementById("chat");
    if (venster.open) venster.close();
    return;
  }
  await laadGesprekken();
  startLiveBerichten();
}

async function laadGesprekken() {
  try { gesprekken = await haalGesprekkenOp(); }
  catch (fout) { console.error(fout); gesprekken = []; }
  tekenGesprekken();
  tekenTeller();
}

// Live: een bericht voor mij komt binnen
function startLiveBerichten() {
  if (chatKanaal || typeof db.channel !== "function") return;
  chatKanaal = db.channel("berichten-" + gebruiker.id)
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "berichten", filter: "naar=eq." + gebruiker.id },
        (gebeurtenis) => nieuwBerichtBinnen(gebeurtenis.new))
    .subscribe();
}

function nieuwBerichtBinnen(bericht) {
  if (!bericht) return;
  const venster = document.getElementById("chat");
  if (venster.open && chatMet && bericht.van === chatMet.id) {
    if (!chatLijst.some(b => b.id === bericht.id)) chatLijst.push(bericht);
    tekenChat();
    markeerGelezen(chatMet.id).catch(console.error);
  } else {
    const vriend = (typeof mijnVrienden !== "undefined" ? mijnVrienden : []).find(v => v.id === bericht.van);
    toonMelding(t("nieuwBerichtVan").replace("{naam}", vriend ? vriend.voornaam : "?") + " " + bericht.tekst.slice(0, 60));
  }
  laadGesprekken();
}

// Terug naar de app (bv. na een andere app op je gsm)? Even kijken of er iets nieuws is
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && typeof gebruiker !== "undefined" && gebruiker) {
    laadGesprekken();
    if (document.getElementById("chat").open) laadChat();
  }
});

// "14:05", "gisteren 14:05" of "12 okt"
function chatTijd(iso) {
  const d = new Date(iso);
  const locale = taal === "fr" ? "fr-BE" : taal === "en" ? "en-GB" : "nl-BE";
  const vandaag = new Date();
  const uur = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === vandaag.toDateString()) return uur;
  const gisteren = new Date(vandaag); gisteren.setDate(vandaag.getDate() - 1);
  if (d.toDateString() === gisteren.toDateString()) return t("gisteren") + " " + uur;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" }) + " " + uur;
}

// ---------- Tabblad Berichten: de lijst met gesprekken ----------
function tekenGesprekken() {
  const lijst = document.getElementById("gesprekkenLijst");
  if (!lijst || !gebruiker) return;
  lijst.innerHTML = "";
  if (!gesprekken.length) {
    lijst.innerHTML = `<li class="uitleg">${esc(t("geenGesprekken"))}</li>`;
  }
  for (const g of gesprekken) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="gesprek${g.ongelezen ? " ongelezen" : ""}">
        ${avatarHTML(g)}
        <span class="naam"><b></b><small></small></span>
        <span class="wanneer"></span>
        ${g.ongelezen ? `<span class="teller">${g.ongelezen}</span>` : ""}
      </button>`;
    li.querySelector("b").textContent = g.voornaam || "?";
    li.querySelector("small").textContent = (g.van_mij ? t("jijPrefix") : "") + (g.laatste || "");
    li.querySelector(".wanneer").textContent = g.verzonden ? chatTijd(g.verzonden) : "";
    li.querySelector("button").onclick = () => openChat(g);
    lijst.appendChild(li);
  }

  // Vrienden met wie je nog geen gesprek hebt: snel een bericht sturen
  const blok = document.getElementById("nieuwGesprekBlok");
  const vak = document.getElementById("nieuwGesprekVrienden");
  const zonder = (typeof mijnVrienden !== "undefined" ? mijnVrienden : []).filter(v => !gesprekken.some(g => g.id === v.id));
  blok.hidden = zonder.length === 0;
  vak.innerHTML = "";
  for (const v of zonder) {
    const knop = document.createElement("button");
    knop.type = "button";
    knop.className = "vriendChip";
    knop.innerHTML = `${avatarHTML(v)}<span></span>`;
    knop.querySelector("span:last-child").textContent = v.voornaam || "?";
    knop.onclick = () => openChat(v);
    vak.appendChild(knop);
  }
}

// ---------- Het chatvenster ----------
async function openChat(vriend) {
  chatMet = vriend;
  chatLijst = [];
  document.getElementById("chatAvatar").innerHTML = avatarHTML(vriend);
  document.getElementById("chatNaam").textContent = vriend.voornaam || "?";
  document.getElementById("chatHandle").textContent = vriend.gebruikersnaam ? "@" + vriend.gebruikersnaam : "";
  document.getElementById("chatBerichten").innerHTML = "";
  const venster = document.getElementById("chat");
  if (!venster.open) {
    if (venster.showModal) venster.showModal(); else venster.setAttribute("open", "");
  }
  await laadChat();
  document.getElementById("chatTekst").focus();
  // Zonder live verbinding: om de 15 seconden kijken
  clearInterval(chatTimer);
  chatTimer = setInterval(() => { if (venster.open) laadChat(); else clearInterval(chatTimer); }, 15000);
}

async function laadChat() {
  if (!chatMet) return;
  try {
    chatLijst = await haalGesprekOp(chatMet.id);
  } catch (fout) {
    console.error(fout);
    return;
  }
  tekenChat();
  if (chatLijst.some(b => b.naar === gebruiker.id && !b.gelezen)) {
    await markeerGelezen(chatMet.id).catch(console.error);
    laadGesprekken();
  }
}

function tekenChat() {
  const vak = document.getElementById("chatBerichten");
  vak.innerHTML = "";
  if (!chatLijst.length) {
    vak.innerHTML = `<p class="uitleg leeg">${esc(t("eersteBericht").replace("{naam}", chatMet.voornaam || "?"))}</p>`;
    return;
  }
  for (const b of chatLijst) {
    const div = document.createElement("div");
    div.className = "bericht " + (b.van === gebruiker.id ? "mijn" : "hun");
    div.innerHTML = `<p></p><small></small>`;
    div.querySelector("p").textContent = b.tekst;
    div.querySelector("small").textContent = chatTijd(b.verzonden);
    vak.appendChild(div);
  }
  vak.scrollTop = vak.scrollHeight;
}

document.getElementById("chatFormulier").onsubmit = async (event) => {
  event.preventDefault();
  const veld = document.getElementById("chatTekst");
  const tekst = veld.value.trim();
  if (!tekst || !chatMet) return;
  const knop = event.target.querySelector("button[type=submit]");
  knop.disabled = true;
  try {
    const bericht = await stuurBericht(chatMet.id, tekst);
    veld.value = "";
    veld.style.height = "";
    if (bericht) chatLijst.push(bericht);
    tekenChat();
    laadGesprekken();
  } catch (fout) {
    alert(t("opslaanMislukt") + " " + fout.message);
  } finally {
    knop.disabled = false;
    veld.focus();
  }
};

// Enter = versturen, Shift+Enter = nieuwe regel. Het vak groeit mee.
document.getElementById("chatTekst").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    document.getElementById("chatFormulier").requestSubmit();
  }
});
document.getElementById("chatTekst").addEventListener("input", (event) => {
  const veld = event.target;
  veld.style.height = "";
  veld.style.height = Math.min(veld.scrollHeight, 140) + "px";
});

function sluitChat() {
  clearInterval(chatTimer);
  chatMet = null;
  document.getElementById("chat").close();
}
document.getElementById("chatSluiten").onclick = () => {
  sluitChat();
  const ritten = document.getElementById("ritten");
  if (ritten.open) ritten.close();
};
// Terug: naar het tabblad Berichten
document.getElementById("chatTerug").onclick = () => {
  sluitChat();
  openRitten("berichten");
};
document.getElementById("chat").addEventListener("close", () => clearInterval(chatTimer));

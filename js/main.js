/* ==========================================================================
   Verlorene Welten — main.js (index.html) — v3 (Feedback-Runde 2)
   ========================================================================== */

let map, markersLayer;
let alleArten = [];
let aktiveRegion = 'Alle';
let aktiveKategorien = new Set(['CR', 'EN', 'VU']);

const REGIONEN = ['Alle', 'Afrika', 'Asien', 'Amerika', 'Ozeanien', 'Europa']; // nur Kontinente, kein "Ozean"

let GESAMTZAHL = 47000; // Fallback, wird beim Start durch echten Wert aus Supabase ersetzt
let CAUSES = { tier: { items: [] }, pflanze: { items: [] } }; // wird beim Start aus Supabase geladen

function aktuellerTyp() {
  return ThemeManager.getTheme();
}

/* ---------- Ebene 1: Hero ---------- */
async function initHero() {
  const url = await ladeHeroBild(aktuellerTyp());
  document.getElementById('hero-image').style.backgroundImage = `url("${url}")`;
}

function animiereZahl() {
  const el = document.getElementById('hero-number');
  el.classList.remove('done');
  el.textContent = '0';
  const dauer = 2200;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / dauer);
    const eased = 1 - Math.pow(1 - t, 3);
    const wert = Math.floor(eased * GESAMTZAHL);
    el.textContent = wert.toLocaleString('de-DE') + (t >= 1 ? '+' : '');
    if (t < 1) requestAnimationFrame(frame);
    else el.classList.add('done');
  }
  requestAnimationFrame(frame);
}

/* ---------- Steuerleiste ---------- */
function initControlbar() {
  const btnTier = document.getElementById('toggle-tier');
  const btnPflanze = document.getElementById('toggle-pflanze');
  const btnMode = document.getElementById('toggle-mode');

  function syncButtons() {
    const typ = aktuellerTyp();
    btnTier.classList.toggle('active', typ === 'tier');
    btnPflanze.classList.toggle('active', typ === 'pflanze');
    btnMode.textContent = ThemeManager.getMode() === 'dark' ? 'Hell' : 'Dunkel';
  }

  btnTier.addEventListener('click', () => { ThemeManager.setTheme('tier'); onThemeChange(); });
  btnPflanze.addEventListener('click', () => { ThemeManager.setTheme('pflanze'); onThemeChange(); });
  btnMode.addEventListener('click', () => { ThemeManager.toggleMode(); syncButtons(); setTileLayer(); });

  syncButtons();
}

async function onThemeChange() {
  document.getElementById('toggle-tier').classList.toggle('active', aktuellerTyp() === 'tier');
  document.getElementById('toggle-pflanze').classList.toggle('active', aktuellerTyp() === 'pflanze');
  document.getElementById('typ-label').textContent = aktuellerTyp() === 'tier' ? 'Tierarten' : 'Pflanzenarten';
  renderCauses();
  animiereZahl();
  await initHero();
  renderMarker();
}

/* ---------- Warum stirbt so viel aus? (typabhängig, aus Supabase) ---------- */
async function ladeCauses() {
  const { data, error } = await supabaseClient.from('aussterbeursachen').select('*').order('reihenfolge');
  if (error) { console.error('ladeCauses:', error); return; }
  CAUSES = { tier: { items: [] }, pflanze: { items: [] } };
  (data || []).forEach(row => CAUSES[row.typ].items.push([row.titel, row.beschreibung]));
}

async function ladeGesamtzahl() {
  const { data, error } = await supabaseClient.from('einstellungen').select('wert').eq('schluessel', 'gesamtzahl_bedrohte_arten').single();
  if (!error && data) GESAMTZAHL = parseInt(data.wert, 10);
}

/* ---------- CR/EN/VU-Kästen (aus Supabase, nicht hartcodiert) ---------- */
async function renderKategorieBoxen() {
  const { data, error } = await supabaseClient.from('kategorien').select('*').order('code', { ascending: false }); // CR, EN, VU
  if (error) { console.error('renderKategorieBoxen:', error); return; }
  document.getElementById('kategorie-boxes').innerHTML = (data || []).map(k => `
    <div class="kategorie-box ${k.code}">
      <div class="code">${k.code}</div>
      <div class="full">${k.vollname}</div>
      <div class="crit">${k.kriterien}</div>
    </div>`).join('');
}

function renderCauses() {
  const typ = aktuellerTyp();
  const data = CAUSES[typ];
  document.getElementById('cause-heading').textContent =
    typ === 'tier' ? 'Warum sterben Tierarten aus?' : 'Warum sterben Pflanzenarten aus?';
  document.getElementById('cause-grid').innerHTML = data.items.map(([titel, text]) =>
    `<div class="cause-card"><strong>${titel}</strong>${text}</div>`).join('');
}

/* ---------- Ebene 2: Weltkarte ---------- */
function setTileLayer() {
  if (window._tileLayer) map.removeLayer(window._tileLayer);
  const dark = ThemeManager.getMode() === 'dark';
  const url = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  window._tileLayer = L.tileLayer(url, { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18 }).addTo(map);
}

function initMap() {
  map = L.map('karte', { worldCopyJump: true, minZoom: 2 }).setView([15, 20], 2);
  setTileLayer();
  markersLayer = L.layerGroup().addTo(map);
}

function passtFilter(art) {
  if (art.typ !== aktuellerTyp()) return false;
  if (!aktiveKategorien.has(art.kategorie)) return false;
  if (aktiveRegion !== 'Alle' && art.region !== aktiveRegion) return false;
  return true;
}

/** Extrahiert aus einem Bestandstext nur die führende Zahl/Spanne, z.B.
 *  "~13.846 (2016)" -> "~13.846", "< 50 bekannte Pflanzen (Philippines)" -> "< 50" */
function nurZahl(text) {
  if (!text) return 'unbekannt';
  const match = text.match(/^[~<>]?\s?[\d.,]+(\s?[–-]\s?[\d.,]+)?\s?(Mio\.|Mrd\.)?\+?/);
  return match && match[0].trim() ? match[0].trim() : text;
}

function popupHtml(art) {
  return `
    <div class="popup-card">
      <img src="${art.bild_url}" alt="${art.name_de}" loading="lazy" onerror="this.style.display='none'">
      <span class="badge ${art.kategorie}">${art.kategorie} — ${art.kategorien?.label || ''}</span>
      <div class="name-de">${art.name_de}</div>
      <div class="name-sci">${art.name_wiss || ''}</div>
      <div class="bestand"><span class="k">Bestand: </span><span class="v">${nurZahl(art.population_text)}</span></div>
      <a class="btn-more" href="detail.html?id=${art.id}">Mehr erfahren →</a>
    </div>`;
}

function renderMarker() {
  markersLayer.clearLayers();
  const typ = aktuellerTyp();
  const sichtbar = alleArten.filter(passtFilter);
  const gesamtDiesesTyp = alleArten.filter(a => a.typ === typ).length;

  sichtbar.forEach(art => {
    if (art.lat == null || art.lng == null) return;
    const farbe = art.kategorien?.farbe_hex || '#999';
    const icon = L.divIcon({ className: '', html: `<div class="art-marker" style="background:${farbe}"></div>`, iconSize: [14, 14] });
    const m = L.marker([art.lat, art.lng], { icon }).addTo(markersLayer);
    m.bindPopup(popupHtml(art), { closeButton: true, autoPan: true });

    let closeTimer;
    let gepinnt = false;

    m.on('mouseover', () => { clearTimeout(closeTimer); m.openPopup(); });
    m.on('mouseout', () => {
      if (gepinnt) return;
      closeTimer = setTimeout(() => m.closePopup(), 250);
    });
    // Klick "pinnt" das Popup dauerhaft offen, bis anderswo geklickt wird
    m.on('click', () => { gepinnt = true; clearTimeout(closeTimer); m.openPopup(); });
    m.on('popupclose', () => { gepinnt = false; });
    // Wenn die Maus die Karte selbst erreicht (statt nur den Marker), Timer stoppen
    m.on('popupopen', () => {
      const el = m.getPopup().getElement();
      if (!el) return;
      el.addEventListener('mouseenter', () => clearTimeout(closeTimer));
      el.addEventListener('mouseleave', () => { if (!gepinnt) closeTimer = setTimeout(() => m.closePopup(), 250); });
    });
  });

  document.getElementById('sichtbar-count').textContent = sichtbar.length;
  document.getElementById('gesamt-count').textContent = gesamtDiesesTyp;
  document.getElementById('typ-label').textContent = typ === 'tier' ? 'Tierarten' : 'Pflanzenarten';
}

function initFilters() {
  const regionWrap = document.getElementById('filter-region');
  REGIONEN.forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (r === 'Alle' ? ' active' : '');
    btn.textContent = r;
    btn.dataset.region = r;
    btn.addEventListener('click', () => {
      aktiveRegion = r;
      document.querySelectorAll('#filter-region .pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      if (r !== 'Alle') {
        const treffer = alleArten.filter(a => a.region === r && a.typ === aktuellerTyp());
        if (treffer.length) {
          const bounds = L.latLngBounds(treffer.map(a => [a.lat, a.lng]));
          map.flyToBounds(bounds.pad(0.4), { duration: 0.8 });
        }
      } else {
        map.flyTo([15, 20], 2, { duration: 0.8 });
      }
      renderMarker();
    });
    regionWrap.appendChild(btn);
  });

  document.querySelectorAll('#filter-kategorie .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (aktiveKategorien.has(cat)) {
        if (aktiveKategorien.size === 1) return;
        aktiveKategorien.delete(cat);
        btn.classList.remove('active');
      } else {
        aktiveKategorien.add(cat);
        btn.classList.add('active');
      }
      renderMarker();
    });
  });
}

function initScrollNudge() {
  document.getElementById('scroll-nudge')?.addEventListener('click', () => {
    document.getElementById('karte-anchor').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ---------- Scroll-Reveal-Animationen (wiederholt sich bei jedem Rein-/Rausscrollen) ---------- */
function initScrollReveal() {
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      entry.target.classList.toggle('in', entry.isIntersecting);
    });
  }, { threshold: 0.15 });
  targets.forEach(t => obs.observe(t));
}

/* ---------- Start ---------- */
(async function start() {
  initControlbar();
  initScrollNudge();
  await Promise.all([ladeCauses(), ladeGesamtzahl(), renderKategorieBoxen()]);
  animiereZahl();
  renderCauses();
  initScrollReveal();
  await initHero();
  initMap();
  initFilters();
  alleArten = await ladeArten();
  renderMarker();
})();

/* ==========================================================================
   Verlorene Welten — config.js
   Einzige Stelle mit Datenbank-Logik. Keine Artendaten sind hier hart codiert -
   alles kommt live aus Supabase.
   ========================================================================== */

const SUPABASE_URL = 'https://deutkxmziqwxcsglfvxl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IwAjPGIbxQfrW1qEGVM4KA_6KCOLHFo';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_BUCKET = 'artenbilder';

/** Öffentliche URL für einen Storage-Pfad (z.B. "tiere/amur-leopard.jpg") */
function bildUrl(storagePath) {
  if (!storagePath) return '';
  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Alle Arten inkl. Bild-URL für die Weltkarte (Ebene 2/3) */
async function ladeArten() {
  const { data: arten, error } = await supabaseClient
    .from('arten')
    .select('*, kategorien(label, farbe_hex)')
    .order('id');
  if (error) { console.error('ladeArten:', error); return []; }

  const { data: bilder } = await supabaseClient
    .from('bilder')
    .select('art_id, storage_path')
    .eq('kategorie', 'art')
    .eq('bild_nr', 1);

  const bildMap = new Map((bilder || []).map(b => [b.art_id, b.storage_path]));

  return arten.map(a => ({
    ...a,
    bild_url: bildUrl(bildMap.get(a.id)),
  }));
}

/** Eine einzelne Art mit allen Detail-Informationen für die Detailseite (Ebene 4) */
async function ladeArtDetail(id) {
  const artId = parseInt(id, 10);

  const [artenRes, bilderRes, bedrohungenRes, popRes, verbreitungRes] = await Promise.all([
    supabaseClient.from('arten').select('*, kategorien(label, farbe_hex)').eq('id', artId).single(),
    supabaseClient.from('bilder').select('*').eq('art_id', artId).order('bild_nr'),
    supabaseClient.from('bedrohungen').select('*').eq('art_id', artId).order('nr'),
    supabaseClient.from('populationsdaten').select('*').eq('art_id', artId).order('jahr'),
    supabaseClient.from('verbreitung').select('*').eq('art_id', artId).order('punkt_nr'),
  ]);

  if (artenRes.error) { console.error('ladeArtDetail:', artenRes.error); return null; }

  const bilder = (bilderRes.data || []).map(b => ({ ...b, url: bildUrl(b.storage_path) }));

  return {
    art: artenRes.data,
    bilder,
    bedrohungen: bedrohungenRes.data || [],
    populationsdaten: popRes.data || [],
    verbreitung: {
      historisch: (verbreitungRes.data || []).filter(v => v.typ === 'historisch').map(v => [v.lat, v.lng]),
      aktuell: (verbreitungRes.data || []).filter(v => v.typ === 'aktuell').map(v => [v.lat, v.lng]),
    },
  };
}

/** Hero-Bild für Ebene 1 je nach Toggle-Zustand */
async function ladeHeroBild(typ) {
  const path = typ === 'tier' ? 'hero/hero-tiere.jpg' : 'hero/hero-pflanzen.jpg';
  return bildUrl(path);
}

/* ==========================================================================
   Theme- und Modus-Verwaltung (Tiere/Pflanzen × Dark/Light)
   Wird session-übergreifend im Speicher gehalten (kein localStorage in Artefakten,
   aber auf der echten Website via GitHub Pages ist localStorage unproblematisch)
   ========================================================================== */
const ThemeManager = (() => {
  const root = document.documentElement;

  function getTheme() {
    return localStorage.getItem('vw_theme') || 'tier';
  }
  function getMode() {
    const saved = localStorage.getItem('vw_mode');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply() {
    const theme = getTheme() === 'tier' ? 'tiere' : 'pflanzen';
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-mode', getMode());
  }
  function setTheme(typ) {
    localStorage.setItem('vw_theme', typ);
    apply();
    document.dispatchEvent(new CustomEvent('vw:theme-changed', { detail: { typ } }));
  }
  function setMode(mode) {
    localStorage.setItem('vw_mode', mode);
    apply();
  }
  function toggleMode() {
    setMode(getMode() === 'dark' ? 'light' : 'dark');
  }

  apply();
  return { getTheme, getMode, setTheme, setMode, toggleMode, apply };
})();

/* ==========================================================================
   Verlorene Welten — detail.js (detail.html: Ebene 4)
   ========================================================================== */

let detailMap, polyHistorisch, polyAktuell;
let popChart;
let jahre = [];       // Jahre mit numerischem Bestand, aufsteigend sortiert
let werte = [];        // zugehörige Werte
let histPunkte = [], aktPunkte = [];

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(id, value, fallback = '—') {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
}

function interpoliere(t) {
  // t: 0 (historisch) bis 1 (aktuell)
  if (!histPunkte.length || !aktPunkte.length || histPunkte.length !== aktPunkte.length) {
    return aktPunkte.length ? aktPunkte : histPunkte;
  }
  return histPunkte.map((p, i) => {
    const a = aktPunkte[i];
    return [p[0] + (a[0] - p[0]) * t, p[1] + (a[1] - p[1]) * t];
  });
}

function updateZeitregler(jahrWert) {
  document.getElementById('zeitregler-jahr').textContent = Math.round(jahrWert);

  if (jahre.length >= 2) {
    const minJ = jahre[0], maxJ = jahre[jahre.length - 1];
    const t = Math.max(0, Math.min(1, (jahrWert - minJ) / (maxJ - minJ)));

    // Karte
    const punkte = interpoliere(t);
    if (polyAktuell) detailMap.removeLayer(polyAktuell);
    polyAktuell = L.polygon(punkte, { color: '#e74c3c', fillColor: '#e74c3c', fillOpacity: 0.45, weight: 2 }).addTo(detailMap);

    // Chart: interpolierten Punkt markieren
    const val = interpolierePopulation(jahrWert);
    if (popChart) {
      popChart.data.datasets[1].data = val !== null ? [{ x: jahrWert, y: val }] : [];
      popChart.update('none');
    }
  }
}

function interpolierePopulation(jahrWert) {
  if (!jahre.length) return null;
  if (jahrWert <= jahre[0]) return werte[0];
  if (jahrWert >= jahre[jahre.length - 1]) return werte[werte.length - 1];
  for (let i = 0; i < jahre.length - 1; i++) {
    if (jahrWert >= jahre[i] && jahrWert <= jahre[i + 1]) {
      const t = (jahrWert - jahre[i]) / (jahre[i + 1] - jahre[i]);
      return werte[i] + (werte[i + 1] - werte[i]) * t;
    }
  }
  return null;
}

function renderThreatCard(b) {
  return `
    <div class="threat-card">
      <span class="sev ${b.schweregrad}">${b.schweregrad || ''}</span>
      <h4>${b.bedrohungsname}</h4>
      <p>${b.kurzbeschreibung || ''}</p>
      ${b.schutzmassnahmen ? `<div class="measures"><strong>Schutzmaßnahme:</strong> ${b.schutzmassnahmen}</div>` : ''}
      ${b.quelle ? `<div class="measures" style="opacity:0.7">Quelle: ${b.quelle}</div>` : ''}
    </div>`;
}

async function init() {
  const id = qs('id');
  if (!id) { document.getElementById('name-de').textContent = 'Keine Art angegeben.'; return; }

  document.getElementById('toggle-mode').addEventListener('click', () => {
    ThemeManager.toggleMode();
    document.getElementById('toggle-mode').textContent = ThemeManager.getMode() === 'dark' ? '☀️ Hell' : '🌙 Dunkel';
  });
  document.getElementById('toggle-mode').textContent = ThemeManager.getMode() === 'dark' ? '☀️ Hell' : '🌙 Dunkel';

  const daten = await ladeArtDetail(id);
  if (!daten) { document.getElementById('name-de').textContent = 'Art nicht gefunden.'; return; }

  const { art, bilder, bedrohungen, populationsdaten, verbreitung } = daten;

  // Theme passend zur Art setzen (Tiere = blau, Pflanzen = grün)
  document.documentElement.setAttribute('data-theme', art.typ === 'tier' ? 'tiere' : 'pflanzen');

  // Header
  const hauptbild = bilder[0]?.url || '';
  document.getElementById('detail-header').style.backgroundImage = `url("${hauptbild}")`;
  setText('name-de', art.name_de);
  setText('name-sci', art.name_wiss, '');
  const badge = document.getElementById('badge-kategorie');
  badge.textContent = `${art.kategorie} — ${art.kategorien?.label || ''}`;
  badge.style.background = art.kategorien?.farbe_hex || '#999';
  document.title = `${art.name_de} — Verlorene Welten`;

  // Galerie (weitere Bilder, falls vorhanden)
  if (bilder.length > 1) {
    document.getElementById('galerie-section').style.display = '';
    document.getElementById('galerie').innerHTML = bilder.slice(1).map(b =>
      `<img src="${b.url}" alt="${art.name_de}" loading="lazy">`).join('');
  }

  // Abschnitt 2
  setText('botschafter-text', art.botschafter_text, '');
  setText('fact-gruppe', art.gruppe);
  setText('fact-ernaehrung', art.ernaehrung);
  setText('fact-sozial', art.sozialverhalten, art.typ === 'pflanze' ? 'n/a' : '—');
  setText('fact-seit', art.existiert_seit);
  setText('fact-besonderheiten', art.besonderheiten);
  setText('fact-oekologie', art.oekologische_rolle);

  // Abschnitt 3: Karte + Zeitregler + Chart
  histPunkte = verbreitung.historisch;
  aktPunkte = verbreitung.aktuell;

  detailMap = L.map('detailkarte', { zoomControl: true, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18,
  }).addTo(detailMap);

  if (histPunkte.length) {
    polyHistorisch = L.polygon(histPunkte, { color: '#7a8fa6', fillColor: '#7a8fa6', fillOpacity: 0.15, weight: 1, dashArray: '4 4' }).addTo(detailMap);
  }
  const alleP = [...histPunkte, ...aktPunkte];
  if (alleP.length) {
    detailMap.fitBounds(L.latLngBounds(alleP).pad(0.3));
  } else if (art.lat && art.lng) {
    detailMap.setView([art.lat, art.lng], 4);
  } else {
    detailMap.setView([15, 20], 2);
  }

  const numPop = populationsdaten.filter(p => p.wert !== null && p.wert !== undefined);
  jahre = numPop.map(p => p.jahr);
  werte = numPop.map(p => Number(p.wert));

  const slider = document.getElementById('zeitregler');
  if (jahre.length >= 2) {
    slider.min = jahre[0];
    slider.max = jahre[jahre.length - 1];
    slider.value = jahre[0];
  } else {
    slider.disabled = true;
  }
  slider.addEventListener('input', () => updateZeitregler(Number(slider.value)));

  const ctx = document.getElementById('pop-chart');
  popChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: numPop[0]?.einheit || 'Bestand',
          data: numPop.map(p => ({ x: p.jahr, y: Number(p.wert) })),
          borderColor: '#198abc',
          backgroundColor: 'rgba(25,138,188,0.15)',
          fill: true,
          tension: 0.25,
          pointRadius: 4,
        },
        {
          label: 'Aktueller Zeitpunkt',
          data: [],
          type: 'scatter',
          pointRadius: 7,
          backgroundColor: '#e74c3c',
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Jahr' }, ticks: { stepSize: 1, precision: 0 } },
        y: { title: { display: true, text: numPop[0]?.einheit || '' } },
      },
      plugins: { legend: { display: false } },
    },
  });

  if (jahre.length >= 2) updateZeitregler(jahre[0]);

  // Abschnitt 4: Bedrohungen
  document.getElementById('threat-cards').innerHTML = bedrohungen.map(renderThreatCard).join('') || '<p>Keine Bedrohungsdaten hinterlegt.</p>';

  // Abschnitt 5: Schutzprojekt
  setText('schutz-name', art.schutzprojekt_name);
  setText('schutz-text', art.hauptbedrohung ? `Hauptbedrohung: ${art.hauptbedrohung}` : '', '');
  const schutzLink = document.getElementById('schutz-link');
  if (art.schutzprojekt_url) { schutzLink.href = art.schutzprojekt_url; } else { schutzLink.style.display = 'none'; }
  const iucnLink = document.getElementById('iucn-link');
  if (art.iucn_url) { iucnLink.href = art.iucn_url; } else { iucnLink.style.display = 'none'; }

  document.getElementById('content').style.display = '';
}

init();

/* ==========================================================================
   Verlorene Welten — detail.js (detail.html: Ebene 4) — v2
   ========================================================================== */

let popChart;
let numPop = []; // { jahr, wert, einheit, quelle }

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(id, value, fallback = '—') {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
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

/* Regler bewegt sich nur über die Indizes der tatsächlich vorliegenden Jahre —
   keine Interpolation, keine "erfundenen" Zwischenwerte. */
function updateZeitregler(index) {
  const punkt = numPop[index];
  if (!punkt) return;

  document.getElementById('zeitregler-jahr').textContent = punkt.jahr;
  document.getElementById('chart-quelle').textContent = punkt.quelle ? `Quelle: ${punkt.quelle}` : '';

  if (popChart) {
    popChart.data.datasets[1].data = [{ x: punkt.jahr, y: punkt.wert }];
    popChart.update('none');
  }
}

async function init() {
  const id = qs('id');
  if (!id) { document.getElementById('name-de').textContent = 'Keine Art angegeben.'; return; }

  const modeBtn = document.getElementById('toggle-mode');
  modeBtn.addEventListener('click', () => {
    ThemeManager.toggleMode();
    modeBtn.textContent = ThemeManager.getMode() === 'dark' ? 'Hell' : 'Dunkel';
  });
  modeBtn.textContent = ThemeManager.getMode() === 'dark' ? 'Hell' : 'Dunkel';

  const daten = await ladeArtDetail(id);
  if (!daten) { document.getElementById('name-de').textContent = 'Art nicht gefunden.'; return; }

  const { art, bilder, bedrohungen, populationsdaten } = daten;

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

  if (bilder.length > 1) {
    document.getElementById('galerie-section').style.display = '';
    document.getElementById('galerie').innerHTML = bilder.slice(1).map(b =>
      `<img src="${b.url}" alt="${art.name_de}" loading="lazy">`).join('');
  }

  // Was ist das für eine Art?
  setText('botschafter-text', art.botschafter_text, '');
  setText('fact-gruppe', art.gruppe);
  setText('fact-ernaehrung', art.ernaehrung);
  setText('fact-seit', art.existiert_seit);

  // Sozialverhalten ergibt bei Pflanzen keinen Sinn -> Kachel komplett entfernen
  if (art.typ === 'pflanze') {
    document.getElementById('fact-sozial-card').remove();
  } else {
    setText('fact-sozial', art.sozialverhalten);
  }

  setText('prose-besonderheiten', art.besonderheiten, 'Keine Angaben hinterlegt.');
  setText('prose-oekologie', art.oekologische_rolle, 'Keine Angaben hinterlegt.');

  // Historische Entwicklung — nur echte Datenpunkte, keine Interpolation
  numPop = populationsdaten
    .filter(p => p.wert !== null && p.wert !== undefined)
    .map(p => ({ jahr: p.jahr, wert: Number(p.wert), einheit: p.einheit, quelle: p.quelle }))
    .sort((a, b) => a.jahr - b.jahr);

  const slider = document.getElementById('zeitregler');

  if (numPop.length >= 2) {
    slider.min = 0;
    slider.max = numPop.length - 1;
    slider.step = 1;
    slider.value = 0;
    document.getElementById('jahr-min').textContent = numPop[0].jahr;
    document.getElementById('jahr-max').textContent = numPop[numPop.length - 1].jahr;
  } else {
    slider.disabled = true;
    document.querySelector('.timeline-controls').style.display = 'none';
  }
  slider.addEventListener('input', () => updateZeitregler(Number(slider.value)));

  const ctx = document.getElementById('pop-chart');
  const einheit = numPop[0]?.einheit && !numPop[0].einheit.includes('(') ? numPop[0].einheit : 'Individuen';

  popChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: einheit,
          data: numPop.map(p => ({ x: p.jahr, y: p.wert })),
          borderColor: 'rgb(25,138,188)',
          backgroundColor: 'rgba(25,138,188,0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointBackgroundColor: 'rgb(25,138,188)',
        },
        {
          // Rein visuelle Markierung des aktuell gewählten Jahres — nicht interaktiv, nicht ziehbar
          label: 'Ausgewähltes Jahr',
          data: [],
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 8,
          pointHitRadius: 0,          // reagiert nicht auf Maus/Touch -> kann nicht "gegriffen" werden
          backgroundColor: '#e0453a',
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      events: ['mousemove', 'mouseout'], // keine Klick-/Drag-Interaktion auf dem Chart selbst
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Jahre' },
          ticks: {
            stepSize: 1,
            callback: (value) => Math.round(value).toString(), // verhindert "2.011" durch Locale-Formatierung
          },
        },
        y: { title: { display: true, text: 'Individuen' } },
      },
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      interaction: { intersect: false, mode: 'nearest' },
    },
  });

  if (numPop.length >= 2) updateZeitregler(0);
  else if (numPop.length === 1) {
    popChart.data.datasets[1].data = [{ x: numPop[0].jahr, y: numPop[0].wert }];
    popChart.update();
    document.getElementById('zeitregler-jahr').textContent = numPop[0].jahr;
  }

  // Bedrohungen
  document.getElementById('threat-cards').innerHTML =
    bedrohungen.map(renderThreatCard).join('') || '<p>Keine Bedrohungsdaten hinterlegt.</p>';

  // Schutzprojekt
  setText('schutz-name', art.schutzprojekt_name);
  setText('schutz-text', art.hauptbedrohung ? `Hauptbedrohung: ${art.hauptbedrohung}` : '', '');
  const schutzLink = document.getElementById('schutz-link');
  if (art.schutzprojekt_url) { schutzLink.href = art.schutzprojekt_url; } else { schutzLink.style.display = 'none'; }
  const iucnLink = document.getElementById('iucn-link');
  if (art.iucn_url) { iucnLink.href = art.iucn_url; } else { iucnLink.style.display = 'none'; }

  document.getElementById('content').style.display = '';
}

init();

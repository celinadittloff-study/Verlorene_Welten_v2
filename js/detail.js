/* ==========================================================================
   Verlorene Welten — detail.js (detail.html) — v4 (Feedback-Runde 3)
   ========================================================================== */

let popChart;
let numPop = [];
let gebietBasistext = '—';
let gebietHistorischNote = null; // nur gesetzt, wenn echte historisch+aktuell-Quellendaten vorliegen

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function setText(id, value, fallback = '—') {
  const el = document.getElementById(id);
  if (el) el.textContent = (value === null || value === undefined || value === '') ? fallback : value;
}

function formatJahr(n) {
  return Math.round(n).toString(); // niemals Locale-Formatierung -> kein "2.011"
}

function formatZahl(n) {
  // Für die KPI-Kachel: normale deutsche Tausendertrennung ist hier gewünscht (Anzeige der Größenordnung)
  return Math.round(n).toLocaleString('de-DE');
}

/** Grobe Flächenschätzung eines Polygons aus echten lat/lng-Punkten (Shoelace-Formel).
 *  Nur für einen relativen Vergleich (historisch vs. aktuell) gedacht, nicht für exakte km². */
function polygonFlaeche(punkte) {
  if (!punkte || punkte.length < 3) return 0;
  let summe = 0;
  for (let i = 0; i < punkte.length; i++) {
    const [lat1, lng1] = punkte[i];
    const [lat2, lng2] = punkte[(i + 1) % punkte.length];
    summe += lng1 * lat2 - lng2 * lat1;
  }
  return Math.abs(summe / 2);
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

function animiereKpi(elId, von, bis) {
  const el = document.getElementById(elId);
  const dauer = 500;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / dauer);
    const wert = von + (bis - von) * (1 - Math.pow(1 - t, 2));
    el.textContent = formatZahl(wert);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = formatZahl(bis);
  }
  requestAnimationFrame(frame);
}

let letzterAnzahlWert = null;

function updateZeitregler(index) {
  const punkt = numPop[index];
  if (!punkt) return;

  document.getElementById('kpi-jahr').textContent = formatJahr(punkt.jahr);
  animiereKpi('kpi-anzahl', letzterAnzahlWert ?? punkt.wert, punkt.wert);
  letzterAnzahlWert = punkt.wert;

  if (gebietHistorischNote) {
    document.getElementById('kpi-gebiet').textContent = index === 0 ? gebietHistorischNote : gebietBasistext;
  }

  if (popChart) {
    popChart.data.datasets[1].data = [{ x: punkt.jahr, y: punkt.wert }];
    popChart.update('none');
  }

  document.querySelectorAll('#daten-tabelle tbody tr').forEach((tr, i) => {
    tr.classList.toggle('aktiv', i === index);
  });
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

  const { art, bilder, bedrohungen, populationsdaten, verbreitung } = daten;

  document.documentElement.setAttribute('data-theme', art.typ === 'tier' ? 'tiere' : 'pflanzen');

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

  setText('fact-gruppe', art.gruppe);
  setText('fact-lebensraum', art.habitat || art.land);
  setText('fact-seit', art.existiert_seit);
  document.getElementById('kpi-gebiet').textContent = art.land || art.habitat || '—';
  gebietBasistext = art.land || art.habitat || '—';

  // Nur wenn echte, in Supabase hinterlegte historisch+aktuell-Kartendaten existieren,
  // wird die Kachel beim Reglerbewegen mitgeändert — sonst bleibt sie unverändert.
  if (verbreitung?.historisch?.length >= 3 && verbreitung?.aktuell?.length >= 3) {
    const flHist = polygonFlaeche(verbreitung.historisch);
    const flAkt = polygonFlaeche(verbreitung.aktuell);
    if (flHist > 0 && flAkt > 0 && flHist > flAkt) {
      const anteil = Math.round((flAkt / flHist) * 100);
      gebietHistorischNote = `${gebietBasistext} — historisch deutlich größer (heute noch ca. ${anteil}% der damaligen Ausdehnung)`;
    }
  }

  if (art.typ === 'pflanze') {
    document.getElementById('fact-ernaehrung-card').remove();
  } else {
    setText('fact-ernaehrung', art.ernaehrung);
  }

  setText('prose-besonderheiten', art.besonderheiten, 'Keine Angaben hinterlegt.');
  setText('prose-oekologie', art.oekologische_rolle, 'Keine Angaben hinterlegt.');

  // Historische Entwicklung
  numPop = populationsdaten
    .filter(p => p.wert !== null && p.wert !== undefined)
    .map(p => ({ jahr: p.jahr, wert: Number(p.wert), einheit: p.einheit, kontext: p.kontext, quelle: p.quelle }))
    .sort((a, b) => a.jahr - b.jahr);

  const slider = document.getElementById('zeitregler');

  if (numPop.length >= 2) {
    slider.min = 0;
    slider.max = numPop.length - 1;
    slider.step = 1;
    slider.value = 0;
    document.getElementById('jahr-min').textContent = formatJahr(numPop[0].jahr);
    document.getElementById('jahr-max').textContent = formatJahr(numPop[numPop.length - 1].jahr);
  } else {
    slider.disabled = true;
    document.querySelector('.timeline-controls').style.display = 'none';
  }
  slider.addEventListener('input', () => updateZeitregler(Number(slider.value)));

  const ctx = document.getElementById('pop-chart');
  const einheit = numPop[0]?.einheit && !numPop[0].einheit.includes('(') ? numPop[0].einheit : 'Individuen';
  // Chartfarbe passend zur aktuellen Theme-Farbe (blau bei Tieren, grün bei Pflanzen)
  const chartColor = getComputedStyle(document.documentElement).getPropertyValue('--c3').trim() || '#198abc';
  const chartColorRgb = chartColor.startsWith('#')
    ? [parseInt(chartColor.slice(1,3),16), parseInt(chartColor.slice(3,5),16), parseInt(chartColor.slice(5,7),16)].join(',')
    : '25,138,188';

  popChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: einheit,
          data: numPop.map(p => ({ x: p.jahr, y: p.wert })),
          borderColor: chartColor,
          backgroundColor: `rgba(${chartColorRgb},0.12)`,
          fill: true,
          tension: 0.2,
          pointRadius: 5,
          pointBackgroundColor: chartColor,
        },
        {
          label: 'Ausgewähltes Jahr',
          data: [],
          type: 'scatter',
          pointRadius: 8,
          pointHoverRadius: 8,
          pointHitRadius: 0,
          backgroundColor: '#e0453a',
          borderColor: '#fff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      events: ['mousemove', 'mouseout'],
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Jahre' },
          ticks: { stepSize: 1, callback: (value) => formatJahr(value) },
        },
        y: { title: { display: true, text: 'Individuen' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            // Ohne diesen Override formatiert Chart.js die x-Achse Locale-abhängig -> "2.011" statt "2011"
            title: (items) => 'Jahr ' + formatJahr(items[0].parsed.x),
          },
        },
      },
      interaction: { intersect: false, mode: 'nearest' },
    },
  });

  // Quellen-/Datentabelle
  const tbody = document.querySelector('#daten-tabelle tbody');
  tbody.innerHTML = numPop.map(p => `
    <tr>
      <td class="jahr">${formatJahr(p.jahr)}</td>
      <td>${p.kontext || '—'}</td>
      <td class="quelle">${p.quelle || '—'}</td>
    </tr>`).join('');

  // Kurze Einordnung, warum die Datendichte über die Jahre schwankt
  const erklaerungEl = document.getElementById('chart-erklaerung');
  if (numPop.length >= 2) {
    erklaerungEl.textContent = `Diese Art wurde zu ${numPop.length} Zeitpunkten zwischen ${formatJahr(numPop[0].jahr)} und ${formatJahr(numPop[numPop.length-1].jahr)} systematisch erfasst. Die Abstände zwischen den Jahren variieren, weil Bestandszählungen bei seltenen oder schwer zugänglichen Arten unregelmäßig stattfinden — oft nur dann, wenn neue Studien, IUCN-Neubewertungen oder gezielte Zählaktionen durchgeführt wurden. Details und Quellen zu jedem Datenpunkt findest du in der Tabelle unten.`;
  } else {
    erklaerungEl.textContent = 'Für diese Art liegen bisher zu wenige vergleichbare Zählungen vor, um einen Verlauf darzustellen — das ist bei seltenen oder schwer erforschbaren Arten keine Ausnahme. Verfügbare Einzelbelege stehen in der Tabelle unten.';
  }

  if (numPop.length >= 2) {
    updateZeitregler(0);
  } else if (numPop.length === 1) {
    popChart.data.datasets[1].data = [{ x: numPop[0].jahr, y: numPop[0].wert }];
    popChart.update();
    document.getElementById('kpi-jahr').textContent = formatJahr(numPop[0].jahr);
    document.getElementById('kpi-anzahl').textContent = formatZahl(numPop[0].wert);
  } else {
    document.querySelector('.kpi-row').style.display = 'none';
    document.querySelector('.pop-chart-wrap').style.display = 'none';
  }

  document.getElementById('threat-cards').innerHTML =
    bedrohungen.map(renderThreatCard).join('') || '<p>Keine Bedrohungsdaten hinterlegt.</p>';

  setText('schutz-name', art.schutzprojekt_name);
  setText('schutz-text', art.hauptbedrohung ? `Hauptbedrohung: ${art.hauptbedrohung}` : '', '');
  if (hauptbild) {
    document.querySelector('.project-card').style.setProperty('--project-bg-image', `url("${hauptbild}")`);
  }
  const schutzLink = document.getElementById('schutz-link');
  if (art.schutzprojekt_url) { schutzLink.href = art.schutzprojekt_url; } else { schutzLink.style.display = 'none'; }
  const iucnLink = document.getElementById('iucn-link');
  if (art.iucn_url) { iucnLink.href = art.iucn_url; } else { iucnLink.style.display = 'none'; }

  document.getElementById('content').style.display = '';
}

init();

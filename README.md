# Verlorene Welten

Interaktive Karte bedrohter Tier- und Pflanzenarten.

**Modul:** Interaktive Medien (INME)
**Studiengang:** Bachelor Medienmanagement (BMM)
**Semester:** Sommersemester 2026

## Worum geht's?

47.000+ Arten weltweit sind laut IUCN Red List bedroht. Diese Website stellt
24 Arten — 12 Tiere, 12 Pflanzen — als "Botschafter" stellvertretend vor:
mit einer interaktiven Weltkarte, Steckbriefen und je einer Detailseite mit
Zeitregler, der zeigt, wie Verbreitungsgebiet und Bestand über die Jahre
geschrumpft sind.

## Seiten

| Datei | Inhalt |
|---|---|
| `index.html` | Einstiegsseite + interaktive Weltkarte mit Filtern |
| `detail.html` | Detailseite einer einzelnen Art (Aufruf z.B. `detail.html?id=1`) |

## Technologien

- HTML, CSS, JavaScript — kein Build-Prozess nötig
- [Leaflet.js](https://leafletjs.com/) — interaktive Karte
- [Chart.js](https://www.chartjs.org/) — Populationsdiagramm
- [Supabase](https://supabase.com/) — Datenbank (Postgres) + Bilder-Hosting (Storage)

## Ordnerstruktur

```
Verlorene_Welten_v2/
├── index.html
├── detail.html
├── css/
│   └── style.css
├── js/
│   ├── config.js      Supabase-Verbindung (einzige Stelle mit Datenbank-Logik)
│   ├── main.js         Karte, Filter, Toggle-Logik (index.html)
│   └── detail.js       Zeitregler, Chart, Bedrohungen (detail.html)
└── README.md
```

## Daten

Alle Artendaten (Steckbriefe, Bedrohungen, Populationszahlen, Verbreitungsgebiete,
Bildquellen) liegen **nicht** im Code, sondern in einer Supabase-Postgres-Datenbank
mit 6 Tabellen: `arten`, `bedrohungen`, `populationsdaten`, `verbreitung`,
`bilder`, `kategorien`. Der Zugriff erfolgt rein lesend über einen öffentlichen
Publishable Key (siehe `js/config.js`) mit Row-Level-Security — Schreibzugriff
ist über diesen Key nicht möglich.

Bilder liegen im Supabase-Storage-Bucket `artenbilder`.

## Datenquellen

- [IUCN Red List](https://www.iucnredlist.org) — Bedrohungsstatus, Populationsdaten
- [WWF](https://www.worldwildlife.org) — Schutzprojekte, Artbeschreibungen
- [GBIF](https://www.gbif.org) — Vorkommensdaten
- [Wikimedia Commons](https://commons.wikimedia.org) / Wikipedia — Bilder & allgemeine Artinformationen

## Lokal testen

Die Seite lädt Daten per `fetch` von Supabase — das funktioniert nicht durch
einfaches Doppelklicken auf `index.html` (Browser blockieren das aus
Sicherheitsgründen). Am einfachsten:

- **VS Code:** Erweiterung "Live Server" installieren → Rechtsklick auf
  `index.html` → "Open with Live Server"
- **Online:** Über GitHub Pages veröffentlichen (Settings → Pages → Branch `main`, Ordner `/ (root)`)

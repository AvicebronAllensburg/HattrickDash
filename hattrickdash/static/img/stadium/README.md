# Stadium-Bilder

Aktuell aktiv: **7 SVG-Designs in Schrägperspektive** (01_tiny.svg – 07_mega.svg),
automatisch ausgewählt nach Gesamtkapazität.

| Datei | Zeigt | Kapazität |
|---|---|---|
| `01_tiny.svg`    | Bolzplatz, eine offene Holz-/Stahltribüne, Bäume | 0–10 k |
| `02_small.svg`   | Vereinsplatz mit zwei Längstribünen | 10–20 k |
| `03_medium.svg`  | 4-Tribünen-Stadion, einstöckig, Anzeigetafel | 20–30 k |
| `04_large.svg`   | 2-stöckige Tribünen rundum, Anzeigetafel | 30–40 k |
| `05_round.svg`   | Ovaler Stadion-Bowl, Sitzringe, Lichtmasten klein | 40–50 k |
| `06_covered.svg` | Großstadion mit Glaskuppel-Dach | 50–60 k |
| `07_mega.svg`    | Mega-Stadion bei Nacht, Lichtmasten, Glasdach, Anzeigecube | 60 k+ |

PNG-Versionen (`stufe1.png` … `stufe7.png`) liegen noch im Ordner als Backup,
werden aktuell nicht verwendet.

## Bilder austauschen

Einfach `stufe<N>.png` durch eigenes Bild gleichen Namens ersetzen — kein Code-Change nötig.

Aspect-Ratio sollte etwa 16:9 sein (oder breiter); das Hero-Element passt das Bild automatisch ein.

## Backup-SVGs

Die alten stilisierten SVG-Versionen liegen noch im selben Ordner:
`01_tiny.svg`, `02_small.svg`, …, `07_mega.svg`.
Wer wieder die SVGs nutzen will: in `static/js/pages/arena.js` die Funktion
`stadiumImagePath()` zurück auf die SVG-Namen setzen.

## Einbindung im Code

`F:\KI\Projekte\Hatrrick.org_Teamanalyzer\hattrickdash\static\js\pages\arena.js` →
Funktion `stadiumImagePath(sizeIdx)` mappt Backend-Wert `size_index` (0–12, 5k-Schritte)
auf eine der Dateien.

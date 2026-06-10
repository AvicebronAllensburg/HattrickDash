# ⚽ HattrickDash

> **Lokales Hattrick-Analyse- und Management-Tool.** Eine moderne Web-App, die du auf deinem eigenen PC laufen lässt – kein Cloud-Zwang, kein Account, deine Daten bleiben bei dir.

HattrickDash zieht regelmäßig Daten aus der offiziellen Hattrick CHPP-API, speichert sie in einer lokalen SQLite-Datenbank und zeigt sie in einer aufgeräumten Oberfläche an — Team, Spieler, Aufstellung, Spiele, Transfers, Finanzen, Stadion, Training, Jugend, alles offline auf deinem eigenen PC.

---

## Inhalt

- [Was kann HattrickDash?](#-was-kann-hattrickdash)
- [Screenshots](#-screenshots)
- [Voraussetzungen](#-voraussetzungen)
- [Installation](#-installation)
- [Ersteinrichtung](#-ersteinrichtung)
- [Tägliche Nutzung](#-tägliche-nutzung)
- [Funktions-Highlights](#-funktions-highlights)
- [Automatisches Polling](#-automatisches-polling-scheduler)
- [Admin-Bereich](#-admin-bereich)
- [Datenschutz & Sicherheit](#-datenschutz--sicherheit)
- [Bekannte Einschränkungen / Roadmap](#-bekannte-einschränkungen--roadmap)
- [FAQ](#-faq)
- [Lizenz](#-lizenz)

---

## 🎯 Was kann HattrickDash?

HattrickDash bietet **acht Hauptbereiche**, alle in einer einzigen Web-App auf `http://localhost:8765`:

| Bereich         | Was du dort siehst |
|-----------------|-------------------|
| **Team**        | Live-Ligatabelle, Teamstimmung, Selbstvertrauen, Fans, Sponsoren, Trainereigenschaften, Trainerstab, Erfolgsrechnung, Stadion-Quickview, Mannschaftswert |
| **Spieler**     | Kompletter Kader mit allen Skills, Form, Erfahrung, Spezialisierung, TSI, Gehalt, Verletzungen, Sperren, Sortierung & Filter, Verletzungsrechner |
| **Spiele**      | Alle Spiele (Liga / Pokal / Freundschaft / Quali) gruppiert nach Saison – mit Punkte/Toren/Ratings/Karten/Ballbesitz pro Saison-Tab |
| **Aufstellung** | Interaktives Spielfeld mit farbcodierten Spielerkarten, Auto-Aufstellungs-Assistent für 6 Formationen (442/352/433/451/532/343), Loddar Stats, HatStats, Speichern/Laden, **direkter Versand an Hattrick** |
| **Transfers**   | Alle Käufe & Verkäufe, P&L pro Saison als Balkendiagramm, automatische Scouting-Empfehlungen für deine schwächsten Positionen |
| **Finanzen**    | Wöchentliche Einnahmen/Ausgaben, Cashflow-Verlauf, Gehaltsstruktur als Tortendiagramm, Sponsor- & Zuschauer-Trend |
| **Stadion**     | Aktuelle Auslastung pro Block + **Arenasizer**: gibt eine Zielgröße ein, bekommst optimale Verteilung + erwartete Einnahmen bei drei Auslastungsgraden |
| **Training**    | Wochenhistorie nach Saisons (klappbar), Trainingstyp-Verteilung, Konditions-Verlauf des Kaders über Zeit |

---

## 📸 Screenshots

> *Folgen, sobald die erste Live-Datenpaarung eingespielt ist. Bis dahin: einfach selbst ausprobieren!*

---

## 📋 Voraussetzungen

| Komponente            | Mindestens          | Empfohlen               |
|-----------------------|---------------------|--------------------------|
| **Betriebssystem**    | Windows 10 / Linux / macOS | Windows 11             |
| **Python**            | 3.11                | 3.12                     |
| **Browser**           | Chrome 100+, Firefox 100+, Edge 100+ | Aktueller Stand   |
| **RAM**               | 1 GB frei           | 2 GB+                    |
| **Festplatte**        | ~200 MB             | je nach Daten-Historie   |
| **Hattrick-Account**  | Aktiv mit eigenem Team | –                     |
| **CHPP-App**          | Eigener Consumer-Key (kostenlos in 2 Min. anlegen) | – |

Internet-Anbindung wird **nur** beim Datenabruf gebraucht – die Auswertung läuft komplett offline.

---

## 🔧 Installation

### Windows (PowerShell)

```powershell
# In den Projektordner wechseln
cd F:\KI\Projekte\Hatrrick.org_Teamanalyzer\hattrickdash

# Erststart: legt automatisch venv an, installiert Pakete und startet den Server.
.\Start_HattrickDash.ps1
```

Falls PowerShell die Skript-Ausführung blockiert:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Linux / macOS

```bash
cd hattrickdash

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765
```

### Manuell unter Windows (ohne Launcher)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8765
```

Beim ersten Start wirst du sehen, dass HattrickDash noch nicht autorisiert ist – die komplette Einrichtung machst du jetzt im **⚙ Admin**-Tab im Browser.

### Komfort-Skripte (Windows)

| Skript                           | Zweck |
|----------------------------------|-------|
| `Setup.ps1`                      | venv anlegen, Pakete installieren, Selbst-Test |
| `Start_HattrickDash.ps1`         | Server mit sichtbarer Konsole starten (gut zum Debuggen) |
| `Start_HattrickDash_Hidden.ps1`  | Server **ohne** Konsolenfenster im Hintergrund starten |
| `Stop_HattrickDash.ps1`          | Alle laufenden HattrickDash-Prozesse beenden |
| `Restart_HattrickDash.ps1`       | Server stoppen + im Hidden-Modus neu starten |

---

## 🚀 Ersteinrichtung – komplett in der Browser-UI

Du brauchst keine Python-Befehle mehr für die Einrichtung – alles läuft im **⚙ Admin**-Tab. Klick im Top-Menü auf "⚙ Admin", dort findest du:

1. **Schritt 1 – Consumer-Credentials**
   Trage Consumer-Key + Consumer-Secret aus deiner CHPP-App ein, klick **💾 Speichern**.

2. **Schritt 2 – OAuth-Login**
   Klick **🌐 OAuth starten** → Hattrick-Browser öffnet sich → bei Hattrick einloggen → App genehmigen → die angezeigte **PIN** ins Feld eintragen → **✓ Bestätigen**.
   Der Server startet danach automatisch neu, damit der Scheduler aktiv wird.

3. **Schritt 3 – Daten-Pull**
   Klick im Admin-Tab auf **⚡ Full-Init** – HattrickDash pullt nacheinander alle Endpoints (~1 Min). Status wird live angezeigt.

Anschließend einfach in einen anderen Tab wechseln (Team / Spieler / Aufstellung …) – die Daten sind sofort da.

### Alternative: CLI-Einrichtung

Falls du lieber die Kommandozeile magst, geht es weiterhin so:

### Schritt 1: CHPP-App registrieren

1. Auf https://chpp.hattrick.org/Apps/User/EditApp.aspx einloggen.
2. **"App erstellen"** wählen, frei vergebbarer Name (z. B. „mein-hattrickdash-zuhause").
3. Du bekommst einen **Consumer Key** und ein **Consumer Secret**. Diese beiden brauchst du im nächsten Schritt.

> ℹ️ Die CHPP-Bedingungen verlangen formal eine **öffentliche** App (Tools nur für sich selbst werden nicht freigegeben). HattrickDash ist deshalb quelloffen (einsehbar) und für jeden **kostenlos zu nicht-kommerziellen Zwecken** nutzbar — Verkauf / kommerzielle Weitergabe ist nicht erlaubt (siehe Lizenz).

### Schritt 2: OAuth-Login durchführen

```powershell
# venv aktivieren (falls noch nicht aktiv)
.\.venv\Scripts\Activate.ps1

# Interaktiver Login
python -m chpp.auth
```

Was passiert:
1. Du wirst nach Consumer-Key + Consumer-Secret gefragt (Eingabe einmalig, wird in `config.json` gespeichert).
2. Ein Browserfenster öffnet sich → bei Hattrick einloggen → App genehmigen.
3. Die angezeigte **PIN** in das Terminal kopieren und Enter drücken.
4. HattrickDash speichert das Access-Token und ermittelt automatisch deine Team-ID.

### Schritt 3: Initialer Daten-Pull

```powershell
python -m chpp.fetcher --full-init
```

Lädt nacheinander:
- Team-Stammdaten + Stimmungswerte
- Kompletten Kader inkl. aller Skills
- Aktuelle Finanzen
- Stadion-Daten
- Aktuelle Trainingswoche
- Trainerstab
- Spielhistorie
- Transferhistorie

Pro Endpoint **5 Sekunden Pause** (Hattrick-Rate-Limit). Erster Lauf dauert etwa 1 Minute.

### Schritt 4: App starten

```powershell
.\Start_HattrickDash.ps1
```
oder manuell:
```powershell
uvicorn main:app --host 127.0.0.1 --port 8765
```

Browser öffnen: **http://localhost:8765**

Fertig.

---

## 📅 Tägliche Nutzung

Sobald HattrickDash läuft, übernimmt der eingebaute Scheduler den Datenabruf automatisch (siehe Abschnitt unten). Du kannst die App einfach offen lassen oder bei Bedarf starten – die Daten sind beim Aufruf sofort da.

**Manueller Pull zwischendurch** (z. B. direkt nach einem Spiel):

```powershell
# Einzel-Endpoint
python -m chpp.fetcher --endpoint players
python -m chpp.fetcher --endpoint economy
python -m chpp.fetcher --endpoint matchlist

# Detail eines bestimmten Spiels nachladen
python -m chpp.fetcher --match-id 1234567890
```

---

## ⭐ Funktions-Highlights

### Aufstellungs-Assistent

- Wähle eine Formation per Klick → HattrickDash füllt automatisch die beste Aufstellung pro Position.
- **Loddar Stats** und **HatStats** werden live berechnet.
- Verletzte / gesperrte Spieler werden standardmäßig ausgeschlossen, kann per Checkbox aktiviert werden.
- Aufstellungen lokal speichern + jederzeit wieder laden.
- **Submit an Hattrick**: Aufstellung direkt aus der App in dein Spiel übertragen (mit doppelter Sicherheitsabfrage – Browser-Confirm + Backend-`confirm: true`).

### Verletzungsrechner

- Alter, Verletzungswochen, Anzahl Ärzte, Heilungstempo eingeben.
- Schätzt Heilungsdauer in Tagen (Faustformel; reale Werte hängen von der Hattrick-Engine ab).

### Arenasizer

- Gib deine geplante neue Stadiongröße ein.
- HattrickDash verteilt sie nach Hattrick-Optimum (60% Stehplätze / 23.5% Sitz / 14% überdacht / 2.5% VIP).
- Zeigt erwartete Einnahmen bei *schlecht* / *mittel* / *hoch*-Auslastung – Basis: deine aktuelle Fanclub-Größe.

### Scouting-Empfehlungen

- Analysiert deinen Kader, identifiziert die schwächsten Positionsgruppen.
- Schlägt pro Position vor: Skill-Anforderung, Budget-Fenster (max. 30% deines Cashs), TSI-Range.
- Hilft, gezielter auf dem Transfermarkt zu suchen.

### Sortierbare Kaderliste

- Klick auf jeden Spaltenkopf sortiert auf-/absteigend.
- Filter per Positions-Dropdown + Volltextsuche.
- Farbcodierte Position (G/DC/DW/W/M/F).
- Icons für Verletzung / Sperre / Spezialisierung / Transfermarkt / Nationalspieler.

---

## ⏰ Automatisches Polling (Scheduler)

Wenn HattrickDash gestartet ist, laufen drei Jobs im Hintergrund:

| Job          | Zeit                  | Was wird geholt? |
|--------------|-----------------------|------------------|
| **Daily**    | jeden Tag 06:00       | Team, Spieler, Finanzen, Stadion, Training, Trainerstab |
| **Matchday** | Di + Sa 23:00         | Spielhistorie + Detail-Pull der jüngsten 3 Partien |
| **Weekly**   | Montag 07:00          | Transfer-History |

Alle Jobs respektieren das CHPP-Rate-Limit (5s zwischen Calls) und haben automatisches Retry mit Backoff.

> Sobald deine `config.json` existiert (= OAuth durchgelaufen), startet der Scheduler automatisch beim App-Start.

---

## 🛠 Admin-Bereich

Der **⚙ Admin**-Tab im Top-Menü ist deine Schaltzentrale:

| Bereich              | Was du da machen kannst |
|----------------------|--------------------------|
| **Status**           | Auf einen Blick: OAuth-Status, Team-ID, Scheduler an/aus, Server-PID, DB- + Log-Größe |
| **Consumer-Cred.**   | Consumer-Key + Secret eingeben/ändern (Eingabe wird in `config.json` gespeichert) |
| **OAuth-Wizard**     | 3-Schritt-Login direkt im Browser, PIN-Feld, Auto-Restart nach Erfolg |
| **Daten-Pull**       | Buttons für jeden Endpoint einzeln + ⚡ Full-Init Knopf, Live-Output |
| **Scheduler-Jobs**   | Alle drei Jobs (daily / matchday / weekly) inkl. nächster Lauf-Zeit, **▶ Jetzt ausführen** Button |
| **Server-Steuerung** | 🔄 **Restart** und 🛑 **Shutdown** – mit Browser-Confirm |
| **Danger Zone**      | 🗑 DB komplett löschen + neu anlegen |
| **Logs**             | Live-Tail der letzten 200 Zeilen aus `logs/app.log`, optional Auto-Refresh alle 3s |

### Hidden-Mode

Wenn du HattrickDash dauerhaft im Hintergrund laufen lassen willst (z. B. nach Windows-Login):

```powershell
.\Start_HattrickDash_Hidden.ps1
```

Es gibt **kein sichtbares Konsolen-Fenster**, der Prozess läuft im Hintergrund (via `pythonw.exe`).
Logs gehen weiterhin in `logs/app.log` – das siehst du auch im Admin-Tab.

Stoppen kannst du den Hintergrund-Prozess jederzeit mit:

```powershell
.\Stop_HattrickDash.ps1
```

oder direkt aus dem Admin-Tab über **🛑 Shutdown**.

---

## 🔒 Datenschutz & Sicherheit

- **Alles lokal**: SQLite-DB in `data/hattrickdash.db`, OAuth-Tokens in `config.json`, Logs in `logs/app.log`. **Nichts** geht an Dritte.
- **Standard-Bind: 127.0.0.1** – nur du selbst auf deinem Rechner kannst zugreifen, kein Netzwerk-Exposure.
- **Wenn du es im Heim-LAN nutzen willst**, kannst du den Bind in `Start_HattrickDash.ps1` auf `0.0.0.0` ändern. Achte dann darauf, dass dein PC keinen direkten Internetzugang erlaubt (Firewall).
- **OAuth statt Passwort**: HattrickDash kennt dein Hattrick-Passwort nie. Das Access-Token kann auf https://chpp.hattrick.org/Apps/User/Apps.aspx jederzeit widerrufen werden.
- **Schreibender Zugriff** (Aufstellung an Hattrick senden) wird **nicht ohne deine Bestätigung** ausgeführt – jeder Submit verlangt einen Browser-Confirm-Dialog plus eine `confirm: true`-Flagge im Request.

**Was du NICHT teilen oder committen solltest**:
- `config.json` (enthält deinen Access-Token)
- `data/hattrickdash.db` (enthält Spielerdaten anderer Manager)
- `logs/` (enthalten ggf. CHPP-Antworten)

Diese drei stehen bereits in `.gitignore`.

---

## 🚧 Bekannte Einschränkungen / Roadmap

**Bereits enthalten**: alle 8 Hauptseiten, OAuth-Flow, Scheduler, HatStats/Loddar, Arenasizer, Scouting, Hattrick-Submit.

**Geplant für spätere Versionen**:
- Drag & Drop auf dem Spielfeld zum manuellen Umstellen
- Wetter-Anzeige für die nächsten Spiele
- Mannschaftsvergleich gegen einen wählbaren Gegner
- Liga-Spielplan mit allen Paarungen pro Spieltag
- Torschützenliste der Liga
- Anzeige der Aufstellungen vergangener Partien
- Excel-/PDF-Export
- Anzeige fixierter Positionen im Auto-Aufstellungs-Assistenten

Wenn dir ein Feature fehlt: gerne ein GitHub-Issue öffnen.

---

## ❓ FAQ

**F: Werden meine Hattrick-Login-Daten irgendwo gespeichert?**
A: Nein. HattrickDash bekommt nur ein OAuth-Token. Dein Passwort gibst du ausschließlich auf hattrick.org ein.

**F: Funktioniert das auch mit einem ausländischen Hattrick-Account?**
A: Ja. CHPP ist sprach-/länderunabhängig. Die UI ist auf Deutsch, lässt sich aber relativ leicht übersetzen.

**F: Kann ich mehrere Teams analysieren?**
A: In v0.1 ist HattrickDash auf ein Team festgelegt (deines). Multi-Team ist auf der Roadmap.

**F: Was passiert, wenn ich die App eine Woche nicht starte?**
A: Beim nächsten Start läuft der nächste Scheduler-Job automatisch zur passenden Tageszeit. Lücken in der Historie kannst du mit `python -m chpp.fetcher --full-init` jederzeit nachholen.

**F: Kann ich die Datenbank manuell anschauen?**
A: Ja. `data/hattrickdash.db` ist eine ganz normale SQLite-Datei, lässt sich mit DB Browser for SQLite, DBeaver oder `sqlite3` öffnen.

**F: Mein OAuth-Token läuft ab. Was tun?**
A: Einfach `python -m chpp.auth` erneut ausführen.

**F: Hattrick zeigt eine Fehlermeldung "Rate Limit"?**
A: Sollte mit den 5s Pause + Backoff nicht vorkommen. Wenn doch: kurz warten, der nächste Scheduler-Lauf greift wieder.

**F: Ich bekomme `503` auf `/api/team/league-table`.**
A: Das ist der einzige Live-Aufruf gegen CHPP (statt aus DB). Tritt nur auf, wenn die OAuth-Session abgelaufen ist – siehe vorherige Frage.

**F: Wie kann ich auf einem anderen Port laufen?**
A: `uvicorn main:app --host 127.0.0.1 --port 9000`

---

## 📜 Lizenz

**PolyForm Noncommercial License 1.0.0** – siehe `LICENSE`.
Du darfst HattrickDash **kostenlos zu nicht-kommerziellen Zwecken** verwenden, anpassen und weitergeben (privat, Hobby, eigenes Team, Vereine, Schulen, Non-Profits). **Nicht erlaubt:** Verkauf, kommerzielle Nutzung oder kommerzielle Weitergabe (ob 1:1 oder verändert). Den Copyright-Hinweis bei Weitergabe beibehalten. Hattrick™ ist eine Marke von Extralives AB; dieses Projekt steht in keiner offiziellen Verbindung zu Hattrick.

---

## 🛠 Mitentwickeln

Pull Requests willkommen. Tech-Stack:

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.x, APScheduler, requests-oauthlib, lxml
- **Frontend**: Vanilla JS, Chart.js (CDN), HTML Canvas – kein Build-Step, kein Webpack
- **DB**: SQLite

Quick-Start fürs Hacken:
```powershell
uvicorn main:app --reload --port 8765
```

Bei `--reload` startet der Scheduler bei jedem Code-Change neu – das ist beim Entwickeln gewollt, sollte im Produktivbetrieb aus bleiben.

---

**Viel Spaß und drei Punkte am Wochenende!** ⚽

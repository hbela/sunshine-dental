# Sunshine Dental — Benutzerhandbuch

*Eine verständliche Anleitung dazu, was diese App leistet und wie Ihre Praxis sie täglich nutzt.*

---

## Was ist das, in einem Satz?

Es ist eine **rund um die Uhr verfügbare KI-Rezeption für Ihre Zahnarztpraxis — sie beantwortet Ihr Telefon *und* chattet auf Ihrer Website — plus ein einfaches Dashboard, mit dem Ihr Team den Kalender, die Patienten, die Anrufe und die Chats verwaltet** — alles an einem Ort.

Stellen Sie es sich vor wie eine unermüdliche Empfangskraft, die nie schläft, nie in die Mittagspause geht und nie einen Anrufer in der Warteschleife lässt — zusammen mit einer klaren, modernen Verwaltungsoberfläche für Ihr Team.

---

## 🎧 Hören Sie einen echten Anruf

Verlassen Sie sich nicht nur auf unser Wort — hier ist ein **echter Anruf**, den die KI-Rezeption von Anfang bis Ende abgewickelt hat, von der Begrüßung bis zum bestätigten Termin. Drücken Sie auf Play und hören Sie rein.

<audio controls preload="none" src="assets/screenshots/latest-call.mp3"></audio>

---

## Die drei Teile der App

### 1. Die KI-Telefonrezeption 🤖📞

Wenn ein Patient Ihre Praxis anruft, nimmt ein KI-Sprachassistent ab und führt ein natürliches Gespräch — genau wie mit einer echten Empfangskraft. Sie kann:

- **Häufige Fragen beantworten** („Wie sind die Öffnungszeiten?", „Wo befinden Sie sich?", „Nehmen Sie auch ohne Termin an?")
- **Termine buchen** — sie prüft, wer verfügbar ist, bietet echte freie Zeitfenster an und reserviert den Platz
- **Bestehende Termine stornieren oder verschieben**
- **Daten neuer Patienten aufnehmen** (Name, Telefon, Grund des Besuchs)
- **Rückrufwünsche bearbeiten**, wenn sich ein Mensch melden muss
- **Mehrere Sprachen sprechen**, sodass Sie eine breitere Gemeinschaft bedienen können

Der entscheidende Punkt: Sie arbeitet rund um die Uhr. Ein Patient mit Zahnschmerzen kann sonntags um 21 Uhr noch einen Termin für Montagmorgen buchen — keine verpassten Anrufe, keine volle Mailbox, kein verlorenes Geschäft.

### 2. Die Chat-Rezeption 💬

Dieselbe KI-Rezeption lebt auch als **Text-Chat** auf Ihrer Website — für die wachsende Zahl von Patienten, die lieber tippen als anrufen. Sie begrüßt Besucher, beantwortet Fragen und bucht, verschiebt oder storniert Termine aus demselben Live-Kalender wie die Telefon-KI — in der Sprache des Patienten (die Sprache lässt sich direkt im Chat-Kopf umschalten).

![Die Chat-Rezeption für Patienten beantwortet eine Frage](assets/screenshots/10-chat.png)

Ein paar Dinge, die Sie wissen sollten:

- **Vor jeder Buchung fragt sie nach einer E-Mail-Adresse**, sodass jede Chat-Buchung automatisch eine Bestätigungs-E-Mail erhält — nichts bleibt unbestätigt.
- **Patienten können sie wie eine App installieren** — ein Tipp im Browser genügt, und Ihre Praxis bekommt ein eigenes Symbol auf dem Startbildschirm, ganz ohne App Store.
- **Jedes Gespräch wird zusammengefasst und protokolliert**, genau wie Telefonanrufe (siehe Chat-Protokolle weiter unten).

### 3. Das Team-Dashboard 💻

Dies ist die Weboberfläche, in die sich Ihr Team einloggt. Hier behalten die Menschen die Kontrolle über alles, was die KI tut. Von hier aus sieht das Team jeden Termin, verwaltet den Kalender, schlägt Patienten nach und prüft, was bei jedem Anruf geschah.

Die Mitarbeiter melden sich mit ihrer eigenen E-Mail-Adresse und ihrem Passwort an:

![Anmeldebildschirm](assets/screenshots/01-login.png)

---

## Wie alles zusammenpasst

Die KI-Rezeption und Ihr Team-Dashboard teilen sich **einen Kalender und eine Patientenliste** — so bleibt alles automatisch synchron. Die KI übernimmt das Telefon; Ihr Team überwacht vom Dashboard aus.

```mermaid
flowchart LR
    Patient([📞 Patient ruft an]) --> AI[🤖 KI-Rezeption]
    Chat([💬 Patient chattet]) --> AI
    AI <--> Core[(📅 Gemeinsamer Kalender<br/>👥 Patientendaten<br/>☎️ Anruf- & Chat-Protokolle)]
    Staff([👩‍⚕️ Ihr Team]) --> Dashboard[💻 Team-Dashboard]
    Dashboard <--> Core
```

## Was bei einem Anruf passiert

Hier der Weg eines einzelnen Anrufs — vom Klingeln bis zum gebuchten Termin:

```mermaid
flowchart TD
    Start([📞 Patient ruft die Praxis an]) --> Answer[🤖 KI antwortet sofort]
    Answer --> Intent{Was benötigt<br/>der Patient?}

    Intent -->|Termin buchen| Check[Live-Kalender auf<br/>freie Zeitfenster prüfen]
    Check --> Offer[Echte freie Zeiten anbieten]
    Offer --> Book[✅ Platz reservieren]
    Book --> Capture[Patientendaten speichern]

    Intent -->|Stornieren / verschieben| Find[Bestehenden Termin finden]
    Find --> Update[✅ Kalender aktualisieren]

    Intent -->|Frage / Zeiten / Adresse| Answer2[💬 Sofort antworten]

    Intent -->|Mensch nötig| Callback[📝 Rückrufwunsch erfassen]

    Capture --> Log[☎️ Anrufzusammenfassung,<br/>Transkript & Stimmung erfassen]
    Update --> Log
    Answer2 --> Log
    Callback --> Log
    Log --> Done([Alles erscheint im<br/>Team-Dashboard])
```

---

## Was Ihr Team im Dashboard tun kann

### 📊 Dashboard (Startbildschirm)
Ein schneller „Wie läuft es heute"-Überblick — die heutigen Termine, Patienten, die auf einen Rückruf warten, wie viele Anrufe diese Woche eingingen und wie zufrieden die Anrufer klangen.

![Dashboard-Übersicht](assets/screenshots/02-dashboard.png)

### 📅 Kalender
Das Herz der App. Ein visueller Wochen-/Tages-/Monatskalender, der alle Termine und die Arbeitszeiten jedes Zahnarztes zeigt.

- **Arbeitszeiten festlegen** — markieren, wann jeder Behandler buchbar ist
- **Zeit blockieren** — Mittagspausen, Besprechungen, Verwaltungszeit
- **Urlaube markieren** — freie Tage, damit nichts gebucht wird, während ein Zahnarzt abwesend ist
- **Termine buchen, verschieben oder stornieren** mit einfachen Klicks und Drag-and-drop
- **Alle Behandler nebeneinander** sehen, sodass der Empfang die ganze Praxis auf einen Blick verwaltet

![Wochenkalender mit Behandler-Verfügbarkeit](assets/screenshots/03-calendar.png)

Die KI-Rezeption liest aus demselben Kalender — so bietet sie immer nur Zeitfenster an, die wirklich frei sind. Keine Doppelbuchungen.

### 👥 Patienten
Ein einfaches Adressbuch aller, die die Praxis kontaktiert haben. Die KI fügt neue Anrufer automatisch hier hinzu, und das Team kann suchen, Verläufe einsehen und Daten aktualisieren.

![Patientenliste mit Suche und Markierungen](assets/screenshots/04-patients.png)

### 📋 Termine
Eine übersichtliche Liste aller Termine — anstehend, abgeschlossen oder storniert. Filtern Sie nach Tag, Zahnarzt oder Patient. Markieren Sie Besuche als abgeschlossen, wenn sie erledigt sind.

![Terminliste](assets/screenshots/05-appointments.png)

### ☎️ Anrufprotokolle
Eine Aufzeichnung jedes Anrufs, den die KI bearbeitet hat, einschließlich:
- Einer schriftlichen **Zusammenfassung** dessen, worum es im Anruf ging
- Des vollständigen **Transkripts** (Wort für Wort), wenn Sie die Details möchten
- Wie sich der Anrufer **fühlte** (positiv / neutral / unzufrieden)
- Ob der Anruf **erfolgreich** war

![Anrufprotokolle mit Stimmung und Ergebnis](assets/screenshots/06-call-logs.png)

Dies ist Ihr Fenster zur Qualitätskontrolle — Sie sehen jederzeit genau, was die KI gesagt und getan hat.

### 💬 Chat-Protokolle
Dieselbe Transparenz für die Chat-Rezeption: Jedes Website-Gespräch wird mit **Sprache, Nachrichtenzahl, Stimmung und Ergebnis** aufgelistet, dazu eine schriftliche Zusammenfassung (in der Sprache des Patienten) und auf Wunsch das vollständige Transkript.

![Chat-Protokolle mit Sprache, Stimmung und Ergebnis](assets/screenshots/09-chat-logs.png)

### 👤 Benutzer (Admins)
Inhaber und Manager verwalten hier ihr Team — sie legen Mitarbeiterkonten an und bestimmen die Rolle jeder Person.

![Benutzerverwaltung](assets/screenshots/07-admin-users.png)

### ⚙️ Einstellungen
Persönliche Kontoeinstellungen — aktualisieren Sie Ihren Namen, ändern Sie Ihr Passwort und (für Zahnärzte) delegieren Sie Ihren Kalender an eine Assistenz. Sprache sowie helles/dunkles Design lassen sich jederzeit über die obere Leiste umschalten.

![Einstellungen](assets/screenshots/08-settings.png)

---

## Wer nutzt was (Rollen)

Verschiedene Teammitglieder sehen verschiedene Dinge, sodass jeder genau den Zugriff erhält, den er braucht:

| Rolle | Was sie tun |
|------|--------------|
| **Behandler** (Zahnarzt) | Verwaltet den eigenen Kalender und die Verfügbarkeit, sieht die eigenen Termine, markiert Besuche als abgeschlossen |
| **Assistenz** (Empfang) | Verwaltet die ganze Praxis — alle Kalender, alle Termine, Patientendaten und Anrufprotokolle |
| **Admin** (Inhaber / Manager) | Alles oben Genannte, plus das Anlegen von Mitarbeiterkonten und die Verwaltung des Teams |

Ein Zahnarzt kann seinen Kalender auch an eine Assistenz **delegieren** — so kann der Empfang den Terminplan in seinem Namen verwalten.

---

## Ein Tag im Leben

**20:55 Uhr, nach Feierabend.** Ein Patient ruft mit einem abgebrochenen Zahn an. Die KI antwortet, findet den nächsten freien Notfalltermin am nächsten Morgen um 9:00 Uhr bei Dr. Nagy, bucht ihn, nimmt Name und Nummer des Patienten auf und bestätigt. Ohne menschliches Zutun.

**9:05 Uhr am nächsten Morgen.** Die Empfangsassistenz loggt sich ein. Das Dashboard zeigt bereits den neuen 9:00-Uhr-Termin im Kalender und den neuen Patienten im System. Sie liest die Anrufzusammenfassung, sieht, dass alles in Ordnung ist, und bereitet das Behandlungszimmer vor.

**Im Laufe des Tages.** Patienten rufen an, um zu verschieben, nach Öffnungszeiten zu fragen oder Rückrufe zu erbitten. Die KI bearbeitet die Routinefälle; alles Ungewöhnliche wird erfasst, damit das Team nachfassen kann. Das Team verbringt seine Zeit mit den Patienten auf dem Behandlungsstuhl — nicht am Telefon.

---

## Warum Praxen es lieben

- **Kein Anruf geht verloren** — jeder Anruf wird beantwortet, auch nachts, am Wochenende und an Feiertagen
- **Kein Telefon-Pingpong mehr** — Patienten buchen sofort selbst
- **Weniger Nichterscheinen** — Termine werden im Moment der Buchung bestätigt und erfasst
- **Entlasten Sie Ihren Empfang** — das Team konzentriert sich auf die Patienten vor Ort statt aufs Telefon
- **Volle Transparenz** — jeder Anruf wird zusammengefasst und aufgezeichnet, sodass Sie stets die Kontrolle behalten
- **Spricht die Sprachen Ihrer Patienten** — bedienen Sie einen größeren Teil Ihrer Gemeinschaft
- **Holt Patienten dort ab, wo sie sind** — Telefon für die einen, Website-Chat für die anderen, ein gemeinsamer Kalender dahinter
- **Patientendaten bleiben wirklich privat** — verschlüsselt mit einem Schlüssel, den nur Ihre Praxis besitzt, und jede Nacht gesichert
- **Ein einfaches System** — Kalender, Patienten, Anrufe und Chats an einem Ort (kein Jonglieren mehr mit Tabellen und separaten Kalendern)

---

## 🔐 So sind die Daten Ihrer Patienten geschützt

Patientendaten sind Gesundheitsdaten, und diese App behandelt sie auch so — mit einem Schutz, den Sie einem Patienten in einem Satz erklären können.

### Verschlüsselt — mit einem Schlüssel, den nur Ihre Praxis besitzt

Alle persönlichen Patientendaten (Namen, Telefonnummern, Terminnotizen, Anruf- und Chat-Transkripte) werden **verschlüsselt** gespeichert, mit AES-256 — derselben Verschlüsselungsfamilie, die auch beim Online-Banking zum Einsatz kommt. Der Schlüssel gehört **allein Ihrer Praxis**: Er wird nie auf dem Server gespeichert und liegt auch nicht bei uns. Praktisch heißt das: Wer die Datenbank stiehlt — oder sogar die Festplatten des Servers —, sieht nur unlesbaren Zeichensalat.

Das hat auch eine sichtbare, alltägliche Seite: Wenn das System neu startet (zum Beispiel nach einem Update), kommt es **gesperrt** zurück. Das Team kann sich weiter anmelden und den Kalender sehen, aber Patientennamen erscheinen als `••••`, bis ein Administrator den Praxis-Schlüssel eingibt — eine Routine von 10 Sekunden:

![Der gesperrte Zustand: ein Admin entsperrt die Patientendaten mit dem Praxis-Schlüssel](assets/screenshots/11-locked.png)

Der Hinweisbalken zeigt sogar einen kurzen „Fingerabdruck" des erwarteten Schlüssels, sodass der Admin auf einen Blick erkennt, dass er den richtigen verwendet — ohne dass der Schlüssel selbst je angezeigt wird.

### Jede Nacht gesichert — in einer Form, die nicht einmal wir lesen können

Jede Nacht um 3 Uhr sichert das System automatisch die **gesamte Datenbank**, verschlüsselt die Sicherung und bewahrt 90 Tage Verlauf auf. Der Clou: Die Sicherungen sind mit einem Verfahren verschlüsselt, mit dem der Server sie zwar *erstellen*, aber nie *zurücklesen* kann — öffnen lässt sich eine Sicherung nur mit dem versiegelten **Wiederherstellungsschlüssel** Ihrer Praxis (einem gedruckten Dokument im Praxistresor).

- **Geht der Server je verloren** (Hardwaredefekt, Katastrophe), wird die neueste Sicherung wiederhergestellt und mit Ihrem gewohnten Schlüssel entsperrt. Dieses Verfahren ist keine Theorie — es wird in regelmäßigen „Feuerübungen" geprobt.
- **Verliert die Praxis je ihren Schlüssel**, lässt er sich mit dem versiegelten Dokument aus dem Tresor wiederherstellen. Kein Datenverlust, kein Anruf beim Anbieter für eine Kopie — wir hatten nie eine.
- Und wenn *beides* verloren geht? Dann sind die Daten unwiederbringlich — **mit Absicht**. Das ist kein Mangel, sondern der Beweis, dass niemand außerhalb Ihrer Praxis je die Daten Ihrer Patienten lesen kann.

---

## Unter der Haube — wie es bereitgestellt ist

*Für technisch Interessierte: Hier ist das tatsächliche System hinter der freundlichen Rezeption.* Das gesamte Produkt läuft als kleine Gruppe von Docker-Containern auf einem einzigen **Hetzner VPS** (verwaltet mit Coolify, das auch HTTPS am Rand terminiert) und kommuniziert mit einigen spezialisierten Cloud-Diensten für Sprache, Chat und E-Mail.

```mermaid
flowchart TB
    browser(["🌐 Patienten- & Team-Browser"]) -->|HTTPS| web
    phone(["📞 Anrufer"]) --> retell

    subgraph vps["🖥️ Hetzner VPS — Coolify + Traefik (TLS)"]
        direction TB
        web["📦 web · nginx + Vite/React SPA<br/>liefert UI, Reverse-Proxy für /api"]
        api["📦 api · Fastify + Prisma + better-auth<br/>PII verschlüsselt AES-256-GCM"]
        db[("📦 db · PostgreSQL 17")]
        backup["📦 backup · nächtliches pg_dump + age"]
        web -->|"HTTP :3000"| api
        api -->|"TCP :5432"| db
        backup -->|"TCP :5432"| db
    end

    subgraph cloud["☁️ Externe Cloud-Dienste"]
        retell["🤖 Retell AI · Sprachagent (gpt-4.1)"]
        n8n["🔀 n8n · Webhook-Router + Workflows"]
        anthropic["💬 Anthropic · Claude Haiku 4.5"]
        gmail["✉️ Gmail · OAuth2-E-Mail"]
    end

    retell -->|HTTPS-Webhook| n8n
    n8n -->|"HTTPS · Bearer → /api"| web
    api -->|"HTTPS (Chat)"| anthropic
    n8n -->|OAuth2| gmail
    backup -.->|age-verschlüsselt, extern| storagebox[("🗄️ Hetzner Storage Box")]
```

- **Hetzner VPS (Coolify + Traefik)** — ein Docker-Stack mit TLS am Rand. Genau derselbe Stack wird zweimal bereitgestellt, als vollständig getrennte Produktions- (`sunshine.appointer.hu`) und Staging-Umgebung (`sunshinedev.appointer.hu`).
- **`web`- / `api`- / `db`- / `backup`-Container** — nginx liefert die React-Single-Page-App und stellt einen Reverse-Proxy für `/api` bereit; eine Fastify-API enthält die Geschäftslogik; eine im Stack laufende PostgreSQL-17-Datenbank speichert alles; und ein nächtlicher Job erstellt eine verschlüsselte Sicherung.
- **Retell AI → n8n → API** — der Telefonweg. Der Retell-Sprachagent ruft einen n8n-Workflow auf, der jede Anfrage über HTTPS mit einem Bearer-Schlüssel an die API weiterleitet; die Antwort kommt auf derselben Verbindung zurück, sodass Anrufer live die tatsächliche Kalenderverfügbarkeit erhalten.
- **Anthropic Claude Haiku 4.5** — der Chat-Weg der Website. Die API spricht direkt mit Claude (ohne Workflow-Umweg) und nutzt exakt dieselbe Buchungslogik wie der Telefonagent.
- **Gmail (OAuth2)** — Buchungsbestätigungen, Anrufzusammenfassungen und Fehlerbenachrichtigungen werden alle von n8n über Gmail versendet.
- **Verschlüsselung mit praxiseigenen Schlüsseln** — Patientendaten werden mit einem Schlüssel verschlüsselt, den nur die Praxis besitzt, und die nächtlichen Sicherungen werden mit einem separaten externen Schlüssel versiegelt (siehe oben: *So sind die Daten Ihrer Patienten geschützt*).

---

## Häufig gestellte Fragen

**Ersetzt die KI mein Team?**
Nein — sie übernimmt die wiederkehrende Telefonarbeit, damit sich Ihr Team auf die Patienten konzentrieren kann. Ihr Team behält über das Dashboard die volle Kontrolle.

**Was, wenn die KI einen Anruf nicht bearbeiten kann?**
Sie erfasst die Anfrage (einschließlich Rückrufwünsche), damit ein Mensch nachfassen kann. In den Anrufprotokollen sehen Sie alles.

**Kann ich sehen, was die KI einem Patienten gesagt hat?**
Ja. Zu jedem Anruf gibt es ein vollständiges schriftliches Transkript und eine Zusammenfassung in den Anrufprotokollen.

**Bucht sie uns doppelt?**
Nein. Die KI bucht nur aus Ihrem Live-Kalender, also bietet sie nur Zeiten an, die tatsächlich frei sind.

**Werden Patientendaten vertraulich behandelt?**
Ja, auf mehreren Ebenen. Der Zugriff ist nach Rolle und Passwort beschränkt. Darüber hinaus werden alle persönlichen Patientendaten **verschlüsselt** gespeichert, und den Schlüssel besitzt allein Ihre Praxis — nicht wir, nicht der Server. Die nächtlichen Sicherungen sind genauso verschlüsselt. Siehe oben: „So sind die Daten Ihrer Patienten geschützt".

**Was passiert, wenn der KI-Chat nicht weiterhelfen kann oder das System gerade aktualisiert wird?**
Der Chat meldet höflich, dass er vorübergehend nicht verfügbar ist — Patienten können weiterhin anrufen. Auf Team-Seite „sperren" Updates die Patientendaten kurzzeitig, bis ein Admin den Praxis-Schlüssel erneut eingibt — der Kalender funktioniert währenddessen durchgehend.

---

*Fragen oder Interesse an einer Vorführung? Nehmen Sie Kontakt mit uns auf — wir geben Ihnen gern eine Live-Demo.*

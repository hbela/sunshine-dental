# Sunshine Dental — Felhasználói útmutató

*Közérthető útmutató arról, mit tud ez az alkalmazás, és hogyan használja a rendelője nap mint nap.*

---

## Mi ez, egyetlen mondatban?

Ez egy **éjjel-nappal elérhető, mesterséges intelligenciás recepciós a fogorvosi rendelőjéhez — csevegésben válaszol a betegeknek a weboldalán —, plusz egy egyszerű felület, amellyel a csapata kezeli a naptárat, a betegeket és a beszélgetéseket** — mindezt egy helyen.

Képzelje el úgy, mintha felvenne egy fáradhatatlan recepcióst, aki soha nem alszik, soha nem megy ebédelni, és soha nem hagy megválaszolatlanul egy kérdést — mindezt egy letisztult, modern adminisztrációs felülettel a munkatársai számára.

---

## Az alkalmazás két része

### 1. A csevegő recepciós 💬

Az MI recepciós a weboldalán **szöveges csevegésként** érhető el. Köszönti a látogatókat, természetes beszélgetést folytat, és az élő naptárból dolgozik — a beteg saját nyelvén (a nyelv a csevegés fejlécében bármikor átváltható). Képes:

- **Megválaszolni a gyakori kérdéseket** („Mik a nyitvatartási idők?", „Hol találhatók?", „Fogadnak előjegyzés nélkül?")
- **Időpontot foglalni** — ellenőrzi, ki elérhető, valódi szabad időpontokat ajánl fel, és lefoglalja a helyet
- **Lemondani vagy átfoglalni** a meglévő időpontokat
- **Felvenni az új beteg adatait** (név, telefonszám, a látogatás oka)
- **Visszahívási kérést kezelni**, ha emberi munkatársnak kell visszajeleznie
- **Több nyelven írni**, így szélesebb közösséget szolgálhat ki

![A betegek csevegő recepciósa válaszol egy kérdésre](assets/screenshots/10-chat.png)

A lényeg: éjjel-nappal működik. Egy fájó foggal küzdő beteg vasárnap este 9-kor is tud időpontot foglalni hétfő reggelre — nincs megválaszolatlan üzenet, nincs elfelejtett kapcsolatfelvételi űrlap, nincs elvesztett bevétel.

👉 **Próbálja ki most, ingyen:** [sunshinedev.appointer.hu/chat](https://sunshinedev.appointer.hu/chat) — nyissa meg, és csevegjen a recepcióssal úgy, ahogy a betegei tennék. Kérdezzen rá a nyitvatartásra, vagy foglaljon egy próbaidőpontot; néhány másodperc az egész, és semmibe sem kerül.

Néhány további dolog, amit érdemes tudni:

- **Foglalás előtt mindig elkér egy e-mail-címet**, így minden foglalásról automatikusan visszaigazoló e-mail megy — semmi sem marad megerősítés nélkül.
- **A betegek alkalmazásként is telepíthetik** a telefonjukra (egyetlen koppintással a böngészőből) — a rendelő saját ikont kap a kezdőképernyőjükön, alkalmazásbolt nélkül.
- **Minden beszélgetésről összefoglaló és napló készül** a munkatársak számára (lásd lentebb a Csevegésnaplókat).

### 2. A munkatársi felület 💻

Ez az a webes képernyő, amelyre a csapata bejelentkezik. Itt tartják kézben az emberek mindazt, amit az MI csinál. Innen a munkatársak látnak minden időpontot, kezelik a naptárat, betegeket keresnek ki, és átnézik az összes beszélgetést, amelyet a recepciós folytatott.

A munkatársak saját e-mail-címmel és jelszóval jelentkeznek be:

![Bejelentkezési képernyő](assets/screenshots/01-login.png)

👉 **Nézzen körül maga is a felületen.** Szívesen adunk Önnek teszthozzáférést mind a három szerepkörhöz — **adminisztrátor**, **orvos** és **asszisztens** —, hogy saját szemével lássa, kinek mi jelenik meg: az adminisztrátor a csapatot és a beállításokat is kezeli, az orvos a saját naptárát és időpontjait látja, az asszisztens pedig az egész rendelőt felügyeli. Kérjen belépést, és próbálja ki mindhármat.

---

## Hogyan kapcsolódik mindez össze

Az MI recepciós és a munkatársi felület **egyetlen közös naptárat és egyetlen közös betegnyilvántartást** használ — így minden automatikusan szinkronban marad. Az MI viszi a beszélgetéseket; a csapata a felületről felügyel.

```mermaid
flowchart LR
    Chat([💬 Beteg csevegést indít]) --> AI[🤖 MI recepciós]
    AI <--> Core[(📅 Közös naptár<br/>👥 Betegadatok<br/>💬 Csevegésnaplók)]
    Staff([👩‍⚕️ Munkatársak]) --> Dashboard[💻 Munkatársi felület]
    Dashboard <--> Core
```

## Mi történik egy beszélgetés során

Íme egyetlen csevegés útja — a köszönéstől a lefoglalt időpontig:

```mermaid
flowchart TD
    Start([💬 A beteg megnyitja a csevegést]) --> Answer[🤖 Az MI azonnal válaszol]
    Answer --> Intent{Mire van szüksége<br/>a betegnek?}

    Intent -->|Időpontfoglalás| Check[Élő naptár ellenőrzése<br/>szabad időpontokért]
    Check --> Offer[Valós szabad időpontok felajánlása]
    Offer --> Book[✅ A hely lefoglalása]
    Book --> Capture[Betegadatok mentése<br/>+ visszaigazoló e-mail]

    Intent -->|Lemondás / átfoglalás| Find[Meglévő időpont megkeresése]
    Find --> Update[✅ Naptár frissítése]

    Intent -->|Kérdés / nyitvatartás / cím| Answer2[💬 Azonnali válasz]

    Intent -->|Emberi segítség kell| Callback[📝 Visszahívási kérés rögzítése]

    Capture --> Log[💬 Beszélgetés-összefoglaló,<br/>átirat és hangulat rögzítése]
    Update --> Log
    Answer2 --> Log
    Callback --> Log
    Log --> Done([Minden megjelenik<br/>a munkatársi felületen])
```

---

## Mit tehet a csapata a felületen

### 📊 Vezérlőpult (kezdőképernyő)
Gyors „hogy állunk ma" áttekintés — a mai időpontok, a visszahívásra váró betegek, hány beszélgetés érkezett ezen a héten, és mennyire elégedettek voltak a betegek.

![Vezérlőpult áttekintés](assets/screenshots/02-dashboard.png)

### 📅 Naptár
Az alkalmazás szíve. Vizuális heti/napi/havi naptár, amely megjeleníti az összes időpontot és minden fogorvos munkaidejét.

- **Munkaidő beállítása** — jelölje meg, mikor foglalható az egyes szolgáltatók ideje
- **Idő lefoglalása** — ebédszünetek, megbeszélések, adminisztratív idő
- **Szabadságok megjelölése** — szabadnapok, hogy ne foglaljanak le semmit, amíg a fogorvos távol van
- **Időpontok foglalása, áthelyezése vagy lemondása** egyszerű kattintással és fogd-és-vidd módszerrel
- Lássa **az összes szolgáltatót egymás mellett**, hogy a recepció egy pillantással átlássa az egész rendelőt

![Heti naptár a szolgáltatók elérhetőségével](assets/screenshots/03-calendar.png)

Az MI recepciós ugyanezt a naptárat olvassa — így mindig csak a valóban szabad időpontokat ajánlja fel. Nincs dupla foglalás.

### 👥 Betegek
Egyszerű címjegyzék mindenkiről, aki kapcsolatba lépett a rendelővel. Az MI automatikusan ide veszi fel az új hívókat, a munkatársak pedig kereshetnek, megtekinthetik az előzményeket és frissíthetik az adatokat.

![Betegek listája kereséssel és jelölésekkel](assets/screenshots/04-patients.png)

### 📋 Időpontok
Letisztult lista minden időpontról — közelgő, befejezett vagy lemondott. Szűrjön nap, fogorvos vagy beteg szerint. Jelölje a látogatásokat befejezettnek, amikor megtörténtek.

![Időpontok listája](assets/screenshots/05-appointments.png)

### 💬 Csevegésnaplók
Minden beszélgetés rögzítése, amelyet az MI kezelt, beleértve:
- Egy írott **összefoglalót** arról, miről szólt — a beteg nyelvén
- A teljes **átiratot** (szóról szóra), ha kíváncsi a részletekre
- A **nyelvet**, amelyen a beteg írt, és hogy hány üzenetből állt a beszélgetés
- Hogyan **érezte magát** a beteg (pozitív / semleges / elégedetlen)
- Hogy a beszélgetés **sikeres** volt-e

![Csevegésnaplók nyelvvel, hangulattal és kimenetellel](assets/screenshots/09-chat-logs.png)

Ez az Ön minőség-ellenőrző ablaka — mindig láthatja pontosan, mit mondott és tett az MI.

### 👤 Felhasználók (Adminok)
A tulajdonosok és vezetők itt kezelik a csapatukat — munkatársi fiókokat hoznak létre, és beállítják mindenki szerepkörét.

![Felhasználókezelés](assets/screenshots/07-admin-users.png)

### ⚙️ Beállítások
Személyes fiókbeállítások — frissítse a nevét, változtassa meg a jelszavát, és (fogorvosok esetén) delegálja a naptárát egy asszisztensnek. A nyelvet és a világos/sötét témát bármikor átválthatja a felső sávból.

![Beállítások](assets/screenshots/08-settings.png)

---

## Ki mit használ (szerepkörök)

A különböző munkatársak különböző dolgokat látnak, így mindenki pontosan azt a hozzáférést kapja, amire szüksége van:

| Szerepkör | Mit csinál |
|------|--------------|
| **Szolgáltató** (fogorvos) | Saját naptárát és elérhetőségét kezeli, látja a saját időpontjait, befejezettnek jelöli a látogatásokat |
| **Asszisztens** (recepció) | Az egész rendelőt kezeli — minden naptárat, minden időpontot, betegadatokat és csevegésnaplót |
| **Admin** (tulajdonos / vezető) | Mindent a fentiekből, plusz munkatársi fiókok létrehozása és a csapat kezelése |

Egy fogorvos a naptárát **delegálhatja** is egy asszisztensnek — így a recepció a nevében kezelheti a beosztását.

---

## Egy nap az életből

**Este 8:55, zárás után.** Egy beteg letört foggal megnyitja a csevegést a weboldalán. Az MI válaszol, megtalálja a következő szabad sürgősségi időpontot másnap reggel 9:00-ra Dr. Nagynál, lefoglalja, felveszi a beteg nevét, telefonszámát és e-mail-címét, és visszaigazolást küld. Emberi közreműködés nélkül.

**Másnap reggel 9:05.** A recepciós asszisztens bejelentkezik. A vezérlőpult már mutatja az új, reggel 9:00-s időpontot a naptárban, és az új beteget a rendszerben. Elolvassa a beszélgetés összefoglalóját, látja, hogy minden rendben van, és előkészíti a rendelőt.

**A nap folyamán.** A betegek átfoglalás miatt írnak, a nyitvatartásról kérdeznek, vagy visszahívást kérnek. Az MI kezeli a rutinszerű eseteket; bármi szokatlan rögzítésre kerül, hogy a munkatársak utánajárhassanak. A csapat a székben ülő betegekre fordítja az idejét — nem a telefonra ragadva.

---

## Miért szeretik a rendelők

- **Egyetlen megkeresés sem marad le** — minden üzenet megválaszolásra kerül, éjszaka, hétvégén és ünnepnapokon is
- **Nincs többé telefonos pingpong** — a betegek azonnal, maguk foglalnak, várakozás nélkül
- **Kevesebb meg nem jelenés** — az időpontokat a foglalás pillanatában e-mailben visszaigazolja a rendszer
- **Tehermentesíti a recepciót** — a munkatársak a személyes betegekre koncentrálnak a telefon helyett
- **Teljes átláthatóság** — minden beszélgetés összefoglalva és rögzítve van, így mindig Ön irányít
- **A betegek nyelvén ír** — a közösség nagyobb részét szolgálja ki, írásban, amit vissza is lehet olvasni
- **Mindig ott van a weboldalán** — a betegek arról az oldalról foglalnak, amelyet éppen néznek, bármilyen eszközön
- **A betegadatok valóban bizalmasak maradnak** — olyan kulccsal titkosítva, amelyet csak az Ön rendelője birtokol, és minden éjjel biztonsági mentéssel
- **Egyetlen egyszerű rendszer** — naptár, betegek és beszélgetések egy helyen (nincs több zsonglőrködés táblázatokkal és külön naptárakkal)

---

## 🔐 Hogyan védjük a betegek adatait

A betegadatok egészségügyi adatok, és ez az alkalmazás ennek megfelelően kezeli őket — olyan védelemmel, amelyet egy betegnek is el tud magyarázni egyetlen lélegzettel.

### Titkosítva — a kulcsot pedig kizárólag az Ön rendelője birtokolja

Minden személyes betegadat (nevek, telefonszámok, időpont-megjegyzések, csevegésátiratok) **titkosítva** tárolódik AES-256-tal — ugyanazzal a titkosítási családdal, amelyet a netbankok is használnak. A titkosítási kulcs **kizárólag az Ön rendelőjéé**: soha nem tárolódik a szerveren, és nálunk sincs meg. A gyakorlatban ez azt jelenti, hogy aki ellopná az adatbázist — vagy akár a szerver lemezeit —, csak olvashatatlan karakterhalmazt látna.

Ennek van egy látható, hétköznapi oldala is: amikor a rendszer újraindul (például egy frissítés után), **zárolt** állapotban tér vissza. A munkatársak be tudnak jelentkezni és látják a naptárat, de a betegnevek `••••`-ként jelennek meg, amíg egy adminisztrátor meg nem adja a rendelő kulcsát — ez egy 10 másodperces rutin:

![A zárolt állapot: az admin a rendelő kulcsával oldja fel a betegadatokat](assets/screenshots/11-locked.png)

A sáv még a várt kulcs rövid „ujjlenyomatát" is mutatja, így az admin egy pillantással meggyőződhet róla, hogy a megfelelő kulcsot készül használni — anélkül, hogy maga a kulcs valaha megjelenne.

### Minden éjjel biztonsági mentés — olyan formában, amelyet még mi sem tudunk elolvasni

A rendszer minden éjjel 3 órakor automatikusan biztonsági mentést készít a **teljes adatbázisról**, titkosítja a mentést, és 90 napnyi előzményt őriz meg. A csavar a dologban: a mentések olyan módszerrel titkosítottak, amellyel a szerver *létrehozni* tudja őket, de *visszaolvasni* soha — egy mentést kizárólag a rendelő lepecsételt **helyreállítási kulcsa** (a rendelő széfjében őrzött nyomtatott dokumentum) tud megnyitni.

- **Ha a szerver valaha elveszne** (hardverhiba, katasztrófa), a legfrissebb mentés visszaállítható, és a megszokott kulccsal feloldható. Ez a visszaállítási eljárás nem elmélet — rendszeres „tűzoltó-gyakorlatokon" próbáljuk el.
- **Ha a rendelő valaha elvesztené a kulcsát**, a széfben őrzött lepecsételt helyreállítási dokumentummal visszanyerhető. Nincs adatvesztés, és nem kell a szolgáltatót hívni másolatért — nekünk soha nem is volt.
- És ha *mindkettő* elveszne? Akkor az adatok helyreállíthatatlanok — **szándékosan**. Ez nem hiba, hanem annak bizonyítéka, hogy a rendelőn kívül soha senki nem olvashatja el a betegei adatait.

---

## A motorháztető alatt — hogyan van üzembe helyezve

*A technikailag érdeklődőknek: íme a barátságos recepció mögötti valódi rendszer.* Az egész termék néhány Docker-konténerként fut egyetlen **Hetzner VPS**-en (Coolify kezeli, amely a HTTPS-t is lezárja a peremen), és két specializált felhőszolgáltatással kommunikál a csevegés és az e-mail számára.

```mermaid
flowchart TB
    browser(["🌐 Beteg és munkatárs böngészője"]) -->|HTTPS| web

    subgraph vps["🖥️ Hetzner VPS — Coolify + Traefik (TLS)"]
        direction TB
        web["📦 web · nginx + Vite/React SPA<br/>felületet szolgál, /api-t proxyz"]
        api["📦 api · Fastify + Prisma + better-auth<br/>PII titkosítva AES-256-GCM"]
        db[("📦 db · PostgreSQL 17")]
        backup["📦 backup · éjszakai pg_dump + age"]
        web -->|"HTTP :3000"| api
        api -->|"TCP :5432"| db
        backup -->|"TCP :5432"| db
    end

    subgraph cloud["☁️ Külső felhőszolgáltatások"]
        anthropic["💬 Anthropic · Claude Haiku 4.5"]
        n8n["🔀 n8n · visszaigazoló e-mail munkafolyamat"]
        gmail["✉️ Gmail · OAuth2 e-mail"]
    end

    api -->|"HTTPS (csevegés)"| anthropic
    api -->|"HTTPS webhook (foglalás)"| n8n
    n8n -->|OAuth2| gmail
    backup -.->|age-gel titkosítva, külső helyre| storagebox[("🗄️ Hetzner Storage Box")]
```

- **Hetzner VPS (Coolify + Traefik)** — egyetlen Docker-verem, TLS-sel a peremen. Pontosan ugyanez a verem kétszer van üzembe helyezve, teljesen különálló éles (`sunshine.appointer.hu`) és teszt (`sunshinedev.appointer.hu`) környezetként.
- **`web` / `api` / `db` / `backup` konténerek** — az nginx szolgálja ki a React egyoldalas alkalmazást és proxyzza az `/api`-t; egy Fastify API tartalmazza az üzleti logikát; egy vermen belüli PostgreSQL 17 adatbázis tárol mindent; egy éjszakai feladat pedig titkosított biztonsági mentést készít.
- **Anthropic Claude Haiku 4.5** — maga a recepciós. Az API közvetlenül a Claude-dal beszél, és a foglalási eszközöket saját folyamatán belül futtatja, ugyanazon a naptáron, amelyet a felület is használ — így a beteg kérése és a naptár válasza között nincs munkafolyamat-ugrás.
- **n8n → Gmail (OAuth2)** — a foglalási visszaigazolások és a hibariasztások. Ez az egyetlen dolog, ami a vermen kívül maradt, és csak e-mailt küld; a foglalási útvonalon semmi nem függ attól, hogy fut-e.
- **Titkosítás, a rendelő birtokolta kulcsokkal** — a betegadatok olyan kulccsal titkosítottak, amelyet kizárólag a rendelő birtokol, az éjszakai mentéseket pedig egy külön, külső helyen tárolt kulcs zárja le (lásd fentebb: *Hogyan védjük a betegek adatait*).

---

## Gyakran ismételt kérdések

**Az MI helyettesíti a munkatársaimat?**
Nem — az ismétlődő recepciós munkát végzi el, hogy a csapata a betegekre koncentrálhasson. A munkatársai a felületen keresztül teljes kontroll alatt tartanak mindent.

**Mi van, ha az MI nem tud kezelni egy kérést?**
Rögzíti a kérést (beleértve a visszahívási kéréseket is), hogy egy ember utánajárhasson. A Csevegésnaplókban mindent lát.

**Láthatom, mit mondott az MI egy betegnek?**
Igen. Minden beszélgetéshez teljes írott átirat és összefoglaló tartozik a Csevegésnaplókban.

**Mi van azokkal a betegekkel, akik inkább telefonálnának?**
Ők a rendelő szokásos telefonszámát hívják, és a csapatát érik el, pontosan úgy, mint eddig — az alkalmazás nem ül rá a telefonvonalára. A csevegés azokat a megkereséseket fogja fel, amelyekből egyébként hangposta, elszalasztott hívás vagy megválaszolatlan kapcsolatfelvételi e-mail lenne.

**Foglal-e dupla időpontot?**
Nem. Az MI csak az élő naptárból foglal, így csak a valóban szabad időpontokat ajánlja fel.

**Bizalmasan kezeli a betegadatokat?**
Igen, több szinten is. A hozzáférés szerepkör szerint és jelszóval korlátozott. Ezen túl minden személyes betegadat **titkosítva** tárolódik, a titkosítási kulcsot pedig kizárólag az Ön rendelője birtokolja — sem mi, sem a szerver. Az éjszakai biztonsági mentések ugyanígy titkosítottak. Lásd fentebb: „Hogyan védjük a betegek adatait".

**Mi történik, ha az MI csevegés nem tud segíteni, vagy éppen frissül a rendszer?**
A csevegés udvariasan jelzi, hogy átmenetileg nem elérhető, és megadja a rendelő telefonszámát. A munkatársi oldalon a frissítések rövid időre „zárolják" a betegadatokat, amíg egy admin újra meg nem adja a rendelő kulcsát — a naptár közben végig működik.

---

*Kérdése van, vagy szeretne egy bemutatót? Vegye fel velünk a kapcsolatot — szívesen tartunk élő demót.*

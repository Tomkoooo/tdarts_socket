# Socket.IO Szerver Stressz Teszt

Ez a stressz teszt szimulálja a valós terhelést a Socket.IO szerveren, progresszíven növelve az aktív meccsek és nézők számát.

## 🎯 Teszt Célja

A teszt célja, hogy megmérje a szerver teljesítményét különböző terhelési szintek mellett:
- **5-300 aktív meccs** között
- **10-1000 néző** között
- Valósághű időzítésekkel (15 másodperc/dobás)
- Részletes statisztikák gyűjtése

## 📊 Mért Metrikák

### Válaszidők (Latency)
- **Minimum, Maximum, Átlag** válaszidők
- **P50, P95, P99 percentilisek**
- Külön mérés dobásokra és match state frissítésekre

### Erőforrás Használat
- **CPU használat** (user + system idő)
- **Memória használat** (heap és RSS)
- Időbeli snapshottok másodpercenként

### Üzenet Statisztikák
- Összes küldött/fogadott üzenet
- Üzenet/másodperc arány
- Hibák száma

## 🚀 Használat

### 1. Környezeti Változók Beállítása

Győződj meg róla, hogy a `.env.local` fájlban be van állítva:

```env
SOCKET_JWT_SECRET=your-secret-key-here
SOCKET_URL=http://localhost:8080
ALLOWED_ORIGIN=https://tdarts.sironic.hu
SOCKET_PORT=8080
ENABLE_MONITORING=true
```

A `ENABLE_MONITORING=true` beállítás engedélyezi a szerveroldali metrikák gyűjtését.

### 2. Socket Szerver Indítása

Először indítsd el a Socket.IO szervert:

```bash
npm run socket-server
```

### 3. Stressz Teszt Futtatása

Új terminálban futtasd a stressz tesztet:

```bash
npm run stress-test
```

## ⚙️ Konfiguráció

A teszt paramétereit a `stress-test.js` fájl `CONFIG` objektumában módosíthatod:

```javascript
const CONFIG = {
  minMatches: 5,        // Kezdő meccsek száma
  maxMatches: 300,      // Maximális meccsek száma
  matchStep: 5,         // Meccsek növelésének lépésköze
  minViewers: 10,       // Kezdő nézők száma
  maxViewers: 1000,     // Maximális nézők száma
  viewerStep: 20,       // Nézők növelésének lépésköze
  throwIntervalMin: 7000,  // Dobások közötti idő minimum (ms)
  throwIntervalMax: 12000, // Dobások közötti idő maximum (ms)
  matchStartDelayMin: 0,   // Meccs indítás késleltetés min (ms)
  matchStartDelayMax: 5000, // Meccs indítás késleltetés max (ms)
  minRounds: 5,         // Minimum körök száma meccsenkent
  maxRounds: 9,         // Maximum körök száma meccsenkent
  startingScore: 501,   // Kezdő pontszám
};
```

## 📈 Hogyan Működik

### Meccs Szimuláció

Minden meccs:
1. Két játékost szimulál (`player1` és `player2`)
2. Csatlakozik a szerverhez JWT tokennel
3. Inicializálja a meccset (`init-match`)
4. Beállítja a játékosokat (`set-match-players`)
5. **Random 0-5mp késleltetéssel elindul** (eltolt indítás!)
6. Váltakozva dob **7-12 másodpercenként** (meccsenkent random időközzel)
7. 5-9 kör után befejeződik

**Fontos**: Minden meccsnek saját random dobási intervalluma van, így a meccsek **nem szinkronizáltan** dobnak. Ez biztosítja a **folyamatos, valósághű terhelést** - egyszerre több meccs is küld dobásokat!

### Néző Szimuláció

Minden néző:
1. Csatlakozik a szerverhez JWT tokennel
2. Egy véletlenszerű meccshez csatlakozik (`join-match`)
3. Passzívan figyeli az eseményeket:
   - `match-state` - meccs állapot frissítések
   - `throw-update` - dobás események

### Progresszív Terhelés

A teszt fokozatosan növeli a terhelést:
- Minden lépésben új meccseket ad hozzá
- Arányosan növeli a nézők számát
- 10 másodpercig futtatja az adott terhelési szintet
- Gyűjti és megjeleniti a statisztikákat
- Automatikusan leáll, ha túl sok hiba történik (>100)

## 📡 Szerveroldali Monitoring

A szerveroldali monitoring automatikusan elindul, ha a `ENABLE_MONITORING=true` környezeti változó be van állítva.

### Gyűjtött Szerveroldali Metrikák

- **CPU használat** (teljes, user, system százalékban)
- **Memória használat** (process és system szinten MB-ban)
- **Socket.IO specifikus metrikák:**
  - Csatlakozott kliensek száma
  - Aktív szobák száma
  - Csatlakozások/lecsatlakozások
  - Fogadott/küldött üzenetek
  - Hibák száma

### Metrikák Mentése

**Automatikus mentés és letöltés:**
- **`client-metrics.json`** - A stressz teszt automatikusan menti a kliens oldali metrikákat a teszt befejezésekor
- **`server-metrics.json`** - A szerver metrikák **automatikusan letöltődnek** a teszt végén:
  - A szerver 30 másodpercenként menti őket
  - A stressz teszt HTTP API-n keresztül letölti őket
  - **Lokálisan elérhetők** még távoli szerver esetén is!

Így **mindig lokálisan megkapod mindkét metrikát**, függetlenül attól, hogy localhost vagy távoli szerveren fut!

A fájl tartalma:
```json
{
  "startTime": 1234567890,
  "endTime": 1234567999,
  "duration": "109.00",
  "systemInfo": {
    "cpuCount": 8,
    "cpuModel": "Apple M1",
    "loadAverage": { "1min": 2.5, "5min": 2.1, "15min": 1.8 }
  },
  "metrics": [
    {
      "timestamp": 1234567890,
      "cpu": { "total": 45.2, "user": 35.1, "system": 10.1 },
      "memory": { "process": {...}, "system": {...} },
      "socketio": { "connectedClients": 150, "activeRooms": 50 }
    }
  ]
}
```

### HTML Vizualizáció

A metrikákat vizuálisan is megjelenítheted egy szép HTML jelentésben:

```bash
npm run visualize
# vagy egyedi fájlokkal:
npm run visualize server-metrics.json metrics-report.html
```

Ez egy interaktív HTML oldalt generál gyönyörű grafikonokkal:
- CPU használat időben
- Memória használat időben  
- Csatlakozott kliensek száma időben
- Összesített statisztikák
- Rendszer információk

A generált HTML fájlt egyszerűen megnyithatod böngészőben.

## 🌐 Távoli Szerver Tesztelés

Ha távoli szerveren (VPS, cloud) szeretnéd futtatni a szervert és lokálisan kapni a metrikákat:

👉 **Nézd meg a [REMOTE_TEST.md](./REMOTE_TEST.md) útmutatót!**

**Röviden:**
- Indítsd el a szervert a távoli gépen `ENABLE_MONITORING=true`-val
- Futtasd lokálisan a tesztet a távoli szerverre mutatva
- A metrikák **automatikusan letöltődnek** lokálisan
- Vizualizálj mindent egy helyen!

## 📊 Kimenet Példa

```
================================================================================
📊 TESZT EREDMÉNYEK - 50 meccs, 200 néző
================================================================================

🎯 Konfiguráció:
  Aktív meccsek: 50
  Aktív nézők: 200
  Összes kliens: 300
  Teszt időtartam: 120.45 másodperc

📨 Üzenetek:
  Összes üzenet: 15432
  Üzenet/másodperc: 128.15
  Hibák: 0

⏱️  Válaszidők (ms):
  Összes üzenet:
    Min: 5.12 ms
    Max: 45.67 ms
    Átlag: 12.34 ms
    P50: 11.23 ms
    P95: 23.45 ms
    P99: 35.67 ms
  Dobások:
    Átlag: 15.23 ms
    P95: 28.90 ms
  Match state frissítések:
    Átlag: 10.12 ms
    P95: 20.34 ms

💻 Erőforrás használat:
  CPU:
    User: 1234.56 ms
    System: 567.89 ms
  Memória:
    Heap használat: 145.67 MB
    RSS: 234.56 MB
================================================================================
```

## 🔍 Figyelendő Értékek

### Jó Teljesítmény Jelei
- ✅ P95 latency < 100ms
- ✅ Hibák száma = 0
- ✅ Stabil memória használat
- ✅ Lineárisan növekvő CPU használat

### Problémák Jelei
- ❌ P95 latency > 500ms
- ❌ Növekvő számú hiba
- ❌ Memória szivárgás (folyamatosan növekvő heap)
- ❌ CPU túlterhelés (100% kihasználtság)

## 🛠️ Hibaelhárítás

### "Connection timeout" hibák
- Ellenőrizd, hogy a Socket szerver fut-e
- Nézd meg a `SOCKET_URL` beállítást
- Növeld a connection timeout értékét a kódban

### "Unauthorized origin" hibák
- Ellenőrizd az `ALLOWED_ORIGIN` beállítást
- Győződj meg róla, hogy a szerver ugyanazt az origin-t használja

### Memória problémák
- Csökkentsd a `maxMatches` vagy `maxViewers` értékét
- Növeld a Node.js heap limitet: `node --max-old-space-size=4096 stress-test.js`

## 📝 Megjegyzések

- A teszt JWT tokeneket generál a teszteléshez
- A dobások pontszámai véletlenszerűek (1-60 pont)
- A meccsek hossza véletlenszerű (5-9 kör)
- A CPU mérés a kliens oldali CPU használatot mutatja
- Valós szerveroldali metrikákhoz használj monitoring eszközöket (pl. PM2, New Relic)


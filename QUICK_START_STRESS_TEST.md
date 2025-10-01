# 🚀 Gyors Útmutató - Socket.IO Stressz Teszt

## 3 lépésben teljes terheléses teszt

### 1️⃣ Környezeti változók beállítása

Szerkeszd a `.env.local` fájlt:

```env
SOCKET_JWT_SECRET=your-secret-key-here
SOCKET_URL=http://localhost:8080
ALLOWED_ORIGIN=https://tdarts.sironic.hu
SOCKET_PORT=8080
ENABLE_MONITORING=true
```

### 2️⃣ Szerver indítása

Nyiss egy terminált és indítsd el a Socket szervert:

```bash
npm run socket-server
```

Várd meg amíg megjelenik:
```
> Socket.IO server running on http://0.0.0.0:8080
> Server monitoring enabled (metrics will be saved to server-metrics.json)
```

### 3️⃣ Stressz teszt futtatása

Nyiss egy **új terminált** és futtasd a tesztet:

```bash
npm run stress-test
```

A teszt automatikusan:
- Fokozatosan növeli a terhelést (5→300 meccs, 10→1000 néző)
- **Meccseket eltolt indítással indít** (0-5mp késleltetéssel) - folyamatos terhelés!
- Minden meccs **7-12mp közötti random időközönként** dob
- **Egyszerre több meccs is küld** dobásokat - valódi stressz!
- Valós idejű statisztikákat jelenít meg
- ~5-10 percig fut (a konfigurációtól függően)

### 4️⃣ Eredmények megtekintése (Opcionális)

A teszt befejezése után:

```bash
npm run visualize
```

Ez létrehoz egy `metrics-report.html` fájlt gyönyörű grafikonokkal.

**Nyisd meg böngészőben:**
```bash
open metrics-report.html  # macOS
xdg-open metrics-report.html  # Linux
start metrics-report.html  # Windows
```

---

## 📊 Mit látsz a teszt során?

### Konzol kimenet (példa):

```
🚀 Stressz teszt indítása...
   Socket URL: http://localhost:8080
   Meccsek: 5 → 300 (lépés: 5)
   Nézők: 10 → 1000 (lépés: 20)
   Dobások gyakorisága: 7-12mp (meccsenkent random)
   Meccs indítás késleltetés: 0-5mp
   ⚡ Meccsek eltolt indítással - folyamatos terhelés!

🔄 Terhelés növelése: 50 meccs, 200 néző...

================================================================================
📊 TESZT EREDMÉNYEK - 50 meccs, 200 néző
================================================================================

🎯 Konfiguráció:
  Aktív meccsek: 50
  Aktív nézők: 200
  Összes kliens: 300

📨 Üzenetek:
  Összes üzenet: 15432
  Üzenet/másodperc: 128.15
  Hibák: 0

⏱️  Válaszidők (ms):
  Átlag: 12.34 ms
  P95: 23.45 ms
  P99: 35.67 ms

💻 Erőforrás használat:
  CPU: 45.2%
  Memória: 145.67 MB
================================================================================
```

### Szerveroldali monitoring (példa):

```
[10.2s] CPU: 25.3% | MEM: 125MB / 8192MB | Clients: 100 | Rooms: 50
[11.2s] CPU: 28.1% | MEM: 132MB / 8192MB | Clients: 120 | Rooms: 60
[12.2s] CPU: 32.4% | MEM: 145MB / 8192MB | Clients: 150 | Rooms: 75
```

---

## ⚙️ Testreszabás

A `stress-test.js` fájlban módosíthatod a `CONFIG` objektumot:

```javascript
const CONFIG = {
  minMatches: 5,
  maxMatches: 300,
  matchStep: 5,
  minViewers: 10,
  maxViewers: 1000,
  viewerStep: 20,
  throwIntervalMin: 7000,   // Dobások min idő (7mp)
  throwIntervalMax: 12000,  // Dobások max idő (12mp)
  matchStartDelayMin: 0,    // Meccs indítás min késleltetés
  matchStartDelayMax: 5000, // Meccs indítás max késleltetés (5mp)
};
```

**Gyorsabb teszt példa:**
```javascript
const CONFIG = {
  minMatches: 5,
  maxMatches: 50,          // Csak 50-ig
  matchStep: 10,           // Nagyobb lépések
  minViewers: 10,
  maxViewers: 200,         // Csak 200-ig
  viewerStep: 50,          // Nagyobb lépések
  throwIntervalMin: 3000,  // Gyorsabb dobások (3-5mp)
  throwIntervalMax: 5000,
  matchStartDelayMin: 0,
  matchStartDelayMax: 2000, // Gyorsabb indítás (0-2mp)
};
```

---

## ⚠️ Hibaelhárítás

### "Connection timeout" hiba
✅ **Megoldás**: Ellenőrizd, hogy a Socket szerver fut-e (`npm run socket-server`)

### "Unauthorized origin" hiba  
✅ **Megoldás**: Állítsd be az `ALLOWED_ORIGIN` változót a `.env.local`-ban

### Túl sok hiba (>100)
✅ **Megoldás**: Csökkentsd a `maxMatches` és `maxViewers` értékeket

### A gépem túl lassú
✅ **Megoldás**: Használd a gyorsabb teszt konfigurációt (fentebb látható)

---

## ⚡ Miért Eltolt Indítás és Random Időzítés?

Ez a stressz teszt **valódi terhelést** szimulál, nem mesterséges csúcsokat!

### ❌ Régi módszer (szinkronizált):
- Minden meccs egyszerre indul
- Minden meccs ugyanabban a pillanatban dob
- Mesterséges csúcsterhelés → nem reális
- Nem teszteli a folyamatos terhelést

### ✅ Új módszer (eltolt, random):
- Meccsek 0-5mp késleltetéssel indulnak
- Minden meccsnek saját 7-12mp dobási intervalluma
- **Folyamatos, egyenletes terhelés**
- Egyszerre több meccs is küld → valódi stressz
- Tükrözi a valós használatot!

**Eredmény**: A szerver folyamatosan kap üzeneteket, nem csak hullámokban. Ez sokkal valósághűbb teszt!

---

## 📁 Generált fájlok

A teszt után a következő fájlokat találod:

| Fájl | Leírás | Mentés |
|------|--------|--------|
| `client-metrics.json` | Kliens oldali metrikák (latency, stb.) | ✅ Teszt befejezésekor |
| `server-metrics.json` | Szerver oldali metrikák (CPU, memória, stb.) | ✅ 30mp-enként + leállításkor |
| `metrics-report.html` | Vizuális jelentés grafikonokkal | ⚙️ `npm run visualize` |

**Fontos változás**: 
- ✅ A **`client-metrics.json` automatikusan létrejön** a teszt befejezésekor
- ✅ A **`server-metrics.json` automatikusan letöltődik** HTTP API-n keresztül
- 🌐 **Távoli szerver esetén is lokálisan kapod meg** mindkét fájlt!
- ⚠️ Ezek a fájlok **nem kerülnek** verziókezelésbe (`.gitignore`)

### 🌐 Távoli Szerver?

Ha nem localhost-on futtatod a szervert, nézd meg a **[REMOTE_TEST.md](./REMOTE_TEST.md)** útmutatót!

---

## 💡 Tippek

1. **Először próbáld kis terheléssel**: Módosítsd `maxMatches: 20`, `maxViewers: 50`
2. **Figyeld a szerveroldali logokat**: Nézd meg mi történik valós időben
3. **Nézd meg a HTML jelentést**: Sokkal átláthatóbb mint a JSON
4. **Futtasd éjszaka**: A teljes teszt (5-300 meccs) ~10-15 percig tart

---

## 🎯 Jó teljesítmény jelei

✅ **P95 latency < 100ms** - Gyors válaszidők  
✅ **0 hiba** - Stabil szerver  
✅ **Stabil memória** - Nincs memória szivárgás  
✅ **CPU < 80%** - Van még tartalék

---

Kérdés esetén nézd meg a részletes dokumentációt: [STRESS_TEST.md](./STRESS_TEST.md)


# 🌐 Távoli Szerver Stressz Teszt

Ez az útmutató megmutatja, hogyan futtathatod a stressz tesztet **távoli szerveren** úgy, hogy **lokálisan kapd meg az összes metrikát**.

## 🎯 Működési Elv

```
┌─────────────┐                    ┌──────────────────┐
│  Lokális    │  Stressz teszt     │  Távoli Szerver  │
│  Gép        │  ─────────────>    │  (VPS/Cloud)     │
│             │                    │                  │
│             │  <─────────────    │                  │
│             │  Metrikák letöltés │                  │
└─────────────┘                    └──────────────────┘

Eredmény: Mindkét metrika lokálisan elérhető!
```

## 📋 Előkészítés

### 1. Szerver Telepítése (Távoli Gépen)

SSH-zz a szerverre és telepítsd a projektet:

```bash
# Klónozd a projektet
git clone <repository-url>
cd tdarts_socket

# Telepítsd a függőségeket
npm install

# Hozd létre a .env.local fájlt
nano .env.local
```

**.env.local a szerveren:**
```env
SOCKET_JWT_SECRET=your-super-secret-key
ALLOWED_ORIGIN=https://tdarts.sironic.hu
SOCKET_PORT=8080
ENABLE_MONITORING=true  # ⚠️ FONTOS!
```

### 2. Szerver Indítása (Távoli Gépen)

```bash
# Indítsd el a Socket szervert
npm run socket-server

# Vagy PM2-vel (ajánlott production-ben)
pm2 start server.js --name tdarts-socket
pm2 logs tdarts-socket
```

### 3. Lokális Konfiguráció (Saját Gépen)

Hozz létre/módosítsd a `.env.local` fájlt **lokálisan**:

```env
SOCKET_JWT_SECRET=your-super-secret-key  # Ugyanaz mint a szerveren!
SOCKET_URL=https://your-server.com:8080  # Távoli szerver URL
ALLOWED_ORIGIN=https://tdarts.sironic.hu
```

**Fontos**: A `SOCKET_JWT_SECRET` **azonos kell legyen** a szerveren és lokálisan!

## 🚀 Teszt Futtatása

### Egyszerű Használat

```bash
# Lokálisan futtasd a tesztet (a távoli szerverre irányítva)
npm run stress-test
```

### Mit Csinál Automatikusan?

1. ✅ Csatlakozik a távoli Socket.IO szerverhez
2. ✅ Szimulál meccseket és nézőket
3. ✅ Gyűjti a kliens oldali metrikákat (latency, stb.)
4. ✅ **Letölti a szerver metrikákat** HTTP API-n keresztül
5. ✅ **Mindkét fájlt lokálisan menti**:
   - `client-metrics.json`
   - `server-metrics.json`

### Vizualizáció

```bash
# Generálj gyönyörű HTML jelentést (lokálisan)
npm run visualize

# Nyisd meg böngészőben
open metrics-report.html  # macOS
xdg-open metrics-report.html  # Linux
start metrics-report.html  # Windows
```

## 📊 Példa Kimenet

```
🚀 Stressz teszt indítása...
   Socket URL: https://your-server.com:8080
   Origin: https://tdarts.sironic.hu
   Meccsek: 5 → 300 (lépés: 5)
   Nézők: 10 → 1000 (lépés: 20)
   ⚡ Meccsek eltolt indítással - folyamatos terhelés!

🔄 Terhelés növelése: 50 meccs, 200 néző...
...

💾 Metrikák mentése és letöltése...
   ✅ Kliens metrikák mentve: client-metrics.json

📡 Szerver metrikák letöltése...
   ✅ Szerver metrikák letöltve: server-metrics.json

🎉 Mindkét metrika fájl lokálisan elérhető!

✅ Stressz teszt befejezve!

📁 Lokálisan generált fájlok:
   - client-metrics.json (kliens oldali metrikák)
   - server-metrics.json (szerver oldali metrikák - letöltve)

💡 Vizualizáció mindkét fájlból: npm run visualize
```

## 🔒 Biztonság

### API Authentikáció

A szerver metrikák egy dedikált `/api/metrics` endpointon érhetők el, JWT tokennel védve:

```javascript
// Endpoint: GET /api/metrics
// A stressz teszt automatikusan JWT tokent generál
const token = jwt.sign({ 
  userId: 'stress-test-admin', 
  userRole: 'admin' 
}, JWT_SECRET);

// És elküldi a kérésben
Authorization: Bearer <token>
```

**Fontos:** Ez egy külön endpoint, nem zavarja a `/api/socket` GET endpointot, amit a Next.js projekt használ!

### CORS Védelem

A szerver csak az `ALLOWED_ORIGIN`-ből érkező kéréseket fogadja el.

### Port és Firewall

Győződj meg róla, hogy a szerveren:
- A `8080` port (vagy amit használsz) **nyitva van**
- A firewall engedi a bejövő kapcsolatokat
- SSL/TLS van beállítva (ajánlott)

```bash
# Firewall példa (Ubuntu/Debian)
sudo ufw allow 8080
sudo ufw status

# Nginx reverse proxy példa
server {
    listen 443 ssl;
    server_name your-server.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🐛 Hibaelhárítás

### "Connection timeout" hiba

```bash
❌ Hiba: Connection timeout
```

**Megoldások:**
1. Ellenőrizd, hogy a szerver fut-e: `ssh user@server "pm2 list"`
2. Teszteld a portot: `telnet your-server.com 8080`
3. Ellenőrizd a firewall-t: `sudo ufw status`
4. Nézd a szerver logokat: `pm2 logs tdarts-socket`

### "Unauthorized origin" hiba

```bash
❌ Rejected connection from unauthorized origin
```

**Megoldások:**
1. Ellenőrizd az `ALLOWED_ORIGIN` értékét mindkét helyen
2. Győződj meg róla, hogy ugyanaz van beállítva lokálisan és a szerveren
3. Nézd a szerver logokat a pontos hibáért

### "Invalid authentication token" hiba

```bash
❌ API Auth failed - Invalid token
```

**Megoldások:**
1. Ellenőrizd, hogy a `SOCKET_JWT_SECRET` **ugyanaz** lokálisan és a szerveren
2. Ne legyen extra whitespace vagy speciális karakter
3. Használj hosszú, biztonságos secret-et

### Szerver metrikák nem tölthetők le

```bash
⚠️  Szerver metrikák nem elérhetők: Server monitoring is not enabled
```

**Megoldás:**
```bash
# Állítsd be a szerveren:
ENABLE_MONITORING=true

# Indítsd újra a szervert
pm2 restart tdarts-socket
```

## 📈 Teljesítmény Tippek

### Nagy Terhelés Tesztelése

Ha sok klienst szeretnél szimulálni:

```javascript
// stress-test.js
const CONFIG = {
  minMatches: 10,
  maxMatches: 500,  // Nagy terhelés!
  minViewers: 50,
  maxViewers: 2000, // Sok néző!
  ...
};
```

### Hálózati Késleltetés

Távoli szerver esetén nagyobb latency várható:
- Lokális: ~5-20ms
- Távoli (EU): ~30-100ms
- Távoli (USA): ~100-200ms

Ez normális és mérhető a client-metrics.json-ben!

## 🎉 Előnyök

1. ✅ **Nincs szükség SSH-ra** a metrikák letöltéséhez
2. ✅ **Automatikus** - minden egy helyen
3. ✅ **Biztonságos** - JWT védelem
4. ✅ **Kényelmes** - egy parancs és kész
5. ✅ **Teljes kép** - szerver ÉS kliens metrikák

---

## 💡 Gyors Referencia

```bash
# TÁVOLI SZERVER (egyszer)
ssh user@server
git clone <repo> && cd tdarts_socket
npm install
nano .env.local  # Állítsd be: ENABLE_MONITORING=true
npm run socket-server  # vagy pm2 start

# LOKÁLIS GÉP (minden teszthez)
nano .env.local  # Állítsd be: SOCKET_URL=https://your-server.com:8080
npm run stress-test  # Futtatás + automatikus metrika letöltés
npm run visualize  # HTML jelentés generálás
open metrics-report.html  # Nézd meg az eredményeket
```

Kész! 🚀


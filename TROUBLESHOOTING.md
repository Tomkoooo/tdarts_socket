# 🔧 Hibaelhárítás - Stressz Teszt

## 🚨 "Nem kaptam vissza server-metrics fájlt"

Ha a stressz teszt után nincs `server-metrics.json` fájl, kövesd ezt a lépésről lépésre útmutatót:

### 1️⃣ Gyors Ellenőrzés - Test Script

```bash
npm run test-metrics
```

Ez a script automatikusan teszteli:
- ✅ A szerver elérhető-e
- ✅ A metrikák letölthetők-e
- ✅ Mi a probléma ha nem működik

### 2️⃣ Ellenőrizd a Szerver Konfigurációt

#### Localhost esetén:

```bash
# 1. Nézd meg a .env.local fájlt
cat .env.local

# Elvárt tartalom:
SOCKET_JWT_SECRET=your-secret-key
SOCKET_URL=http://localhost:8080
ENABLE_MONITORING=true  # ⚠️ EZ KELL!
```

#### Távoli szerver esetén:

```bash
# SSH-zz a szerverre
ssh user@your-server.com

# Nézd meg a .env.local-t
cat tdarts_socket/.env.local

# Elvárt tartalom:
ENABLE_MONITORING=true  # ⚠️ KELL!
SOCKET_JWT_SECRET=your-secret-key
ALLOWED_ORIGIN=https://tdarts.sironic.hu
```

### 3️⃣ Indítsd Újra a Szervert

Ha hiányzott az `ENABLE_MONITORING=true`:

```bash
# Localhost
npm run socket-server

# Távoli szerver (PM2)
pm2 restart tdarts-socket
pm2 logs tdarts-socket
```

Várd meg ezt a logot:
```
📊 Server monitoring started...
   Metrikák automatikus mentése: minden 30mp
   Mentés helye: server-metrics.json
```

### 4️⃣ Ellenőrizd hogy Létrejött-e a Fájl

```bash
# Localhost
ls -la server-metrics.json

# Távoli szerver
ssh user@server "ls -la tdarts_socket/server-metrics.json"
```

Ha nem létezik még:
- Várj 30 másodpercet (első automatikus mentés)
- VAGY küldj egy csatlakozást (pl. indítsd el a tesztet)

### 5️⃣ Teszteld a Metrikák Letöltését

```bash
npm run test-metrics
```

Ez megmutatja pontosan mi a probléma.

---

## 🚨 Gyakori Hibák és Megoldások

### Hiba: "Server monitoring is not enabled"

```
⚠️  Szerver metrikák nem elérhetők: Server monitoring is not enabled
```

**Megoldás:**
```bash
# .env.local fájlban:
ENABLE_MONITORING=true

# Indítsd újra a szervert
npm run socket-server
```

### Hiba: "Metrics file not found"

```
⚠️  Szerver metrikák nem elérhetők: Metrics file not found or could not be read
```

**Ok:** A monitoring fut, de még nem mentett le fájlt.

**Megoldás:**
1. Várj 30 másodpercet (első automatikus mentés)
2. VAGY csatlakozz a szerverhez (indítsd a tesztet)
3. VAGY állítsd le és indítsd újra (ez trigger-eli a mentést)

### Hiba: "Connection refused" / "ECONNREFUSED"

```
❌ Szerver metrikák letöltése sikertelen: connect ECONNREFUSED
```

**Megoldás:**
1. Ellenőrizd hogy a szerver fut-e:
   ```bash
   # Localhost
   curl http://localhost:8080/api/socket
   
   # Távoli
   curl https://your-server.com:8080/api/socket
   ```

2. Ellenőrizd a tűzfalat (távoli szerver):
   ```bash
   sudo ufw status
   sudo ufw allow 8080
   ```

3. Ellenőrizd a SOCKET_URL-t:
   ```bash
   # .env.local
   SOCKET_URL=http://localhost:8080  # Localhost
   # VAGY
   SOCKET_URL=https://your-server.com:8080  # Távoli
   ```

### Hiba: "Unauthorized origin"

```
❌ API Auth failed - Origin mismatch
```

**Megoldás:**
Az `ALLOWED_ORIGIN` ugyanaz kell legyen a szerveren és lokálisan:

```bash
# Mindkét helyen:
ALLOWED_ORIGIN=https://tdarts.sironic.hu
```

### Hiba: "Invalid authentication token"

```
❌ API Auth failed - Invalid token
```

**Megoldás:**
A `SOCKET_JWT_SECRET` ugyanaz kell legyen a szerveren és lokálisan:

```bash
# Lokális .env.local
SOCKET_JWT_SECRET=your-super-secret-key

# Szerver .env.local (SSH)
SOCKET_JWT_SECRET=your-super-secret-key  # UGYANAZ!
```

---

## 📋 Ellenőrző Lista

Mielőtt futtatsz egy stressz tesztet, ellenőrizd:

### Localhost Teszt
- [ ] `ENABLE_MONITORING=true` a `.env.local`-ban
- [ ] `SOCKET_URL=http://localhost:8080` beállítva
- [ ] `SOCKET_JWT_SECRET` beállítva
- [ ] Szerver fut: `npm run socket-server`
- [ ] Látod: "📊 Server monitoring started..."
- [ ] Test sikeres: `npm run test-metrics`

### Távoli Szerver Teszt
- [ ] **Szerveren**: `ENABLE_MONITORING=true` a `.env.local`-ban
- [ ] **Szerveren**: Szerver fut és látod a monitoring logot
- [ ] **Lokálisan**: `SOCKET_URL=https://your-server.com:8080`
- [ ] **Mindkét helyen**: Ugyanaz a `SOCKET_JWT_SECRET`
- [ ] **Mindkét helyen**: Ugyanaz az `ALLOWED_ORIGIN`
- [ ] Port nyitva: `telnet your-server.com 8080`
- [ ] Test sikeres: `npm run test-metrics`

---

## 🐛 Debug Mód

Ha még mindig nem működik, kapcsold be a debug módot:

### Szerver oldalon:

```javascript
// server.js - átmenetileg add hozzá
console.log('Monitor initialized:', !!monitor);
console.log('Monitor output file:', monitor?.outputFile);
```

### Kliens oldalon:

```bash
# Futtasd a tesztet és figyeld a kimenetet
npm run stress-test 2>&1 | tee test-output.log
```

Nézd meg a `test-output.log`-ot részletesen.

---

## 💡 Hasznos Parancsok

```bash
# Teszteld a metrikák letöltését
npm run test-metrics

# Nézd meg mi van a .env.local-ban
cat .env.local | grep -E "ENABLE_MONITORING|SOCKET_URL|SOCKET_JWT_SECRET"

# Ellenőrizd a szerver portot
netstat -an | grep 8080

# Nézd a szerver logokat (PM2)
pm2 logs tdarts-socket --lines 100

# Teszteld a szerver API-t
curl -X POST http://localhost:8080/api/socket \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"action":"get-server-metrics"}'
```

---

## 📞 További Segítség

Ha ezek után sem működik:

1. Futtasd: `npm run test-metrics` és mentsd el a kimenetet
2. Nézd meg a szerver logokat
3. Ellenőrizd a `.env.local` fájlt (mindkét helyen)
4. Küldj screenshot-okat a hibákról

A leggyakoribb ok: **`ENABLE_MONITORING=true` hiányzik a szerver `.env.local`-jából!**


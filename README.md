# TDarts Socket Server

This project separates the Socket.IO server from the Next.js application, allowing them to run independently.

## Architecture

- **Socket.IO Server** (`server.js`): Runs on port 8080, handles all real-time game logic
- **Next.js Server** (`next-server.js`): Runs on port 3000, serves the web application

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with the following configuration:
```env
# Socket.IO Server Configuration
SOCKET_PORT=8080
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080

# Next.js App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
PORT=3000

# Environment
NODE_ENV=development
```

## Running the Servers

### Development Mode
Run both servers simultaneously:
```bash
npm run dev
```

This will start:
- Socket.IO server on `http://localhost:8080`
- Next.js server on `http://localhost:3000`

### Production Mode
1. Build the Next.js application:
```bash
npm run build
```

2. Start both servers:
```bash
npm start
```

### Running Servers Separately

If you want to run the servers independently:

**Socket.IO Server only:**
```bash
npm run socket-server
```

**Next.js Server only:**
```bash
npm run next-server
```

## Client Connection

In your Next.js application, connect to the Socket.IO server using:

```javascript
import { io } from 'socket.io-client';

const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080');
```

## API Endpoints

The Socket.IO server also provides REST API endpoints:

### GET `/api/socket`
Returns server status:
```json
{
  "success": true,
  "message": "Socket.IO endpoint ready",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST `/api/socket`
Get match data with different actions:

**Get match state:**
```json
{
  "action": "get-match-state",
  "matchId": "match-123"
}
```

**Get live matches:**
```json
{
  "action": "get-live-matches"
}
```

Response for live matches:
```json
{
  "success": true,
  "matches": [
    {
      "_id": "match-123",
      "currentLeg": 1,
      "player1Remaining": 501,
      "player2Remaining": 501,
      "player1Id": "player1",
      "player2Id": "player2",
      "player1Name": "Player 1",
      "player2Name": "Player 2",
      "player1LegsWon": 0,
      "player2LegsWon": 0,
      "status": "ongoing"
    }
  ]
}
```

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Socket Server Configuration
SOCKET_PORT=8080
SOCKET_JWT_SECRET=your-super-secret-jwt-key-here
SOCKET_API_KEY=your-api-key-here
ALLOWED_ORIGIN=https://tdarts.sironic.hu

# Next.js Configuration
PORT=3000
NEXT_PUBLIC_SOCKET_URL=https://tdarts.sironic.hu:8080
NEXT_PUBLIC_APP_URL=https://tdarts.sironic.hu
```

### Required Variables:
- `SOCKET_JWT_SECRET`: JWT signing secret for token validation
- `SOCKET_API_KEY`: API key for authentication
- `ALLOWED_ORIGIN`: Allowed origin for CORS (your domain)
- `SOCKET_PORT`: Port for Socket.IO server (default: 8080)
- `PORT`: Port for Next.js server (default: 3000)

## Benefits of Separation

1. **Independent Scaling**: Socket.IO server can be scaled separately from the web server
2. **Better Resource Management**: Each server can be optimized for its specific purpose
3. **Easier Deployment**: Can deploy Socket.IO server to different infrastructure
4. **Clear Separation of Concerns**: Real-time logic is isolated from web serving logic

## 🧪 Stressz Teszt

A projekt tartalmaz egy átfogó stressz teszt eszközt a Socket.IO szerver teljesítményének mérésére.

### Gyors Start

1. **Szerver indítása monitoring-gal:**
```bash
# .env.local fájlban:
ENABLE_MONITORING=true

npm run socket-server
```

2. **Stressz teszt futtatása:**
```bash
npm run stress-test
```

3. **Eredmények vizualizálása:**
```bash
npm run visualize
```

**Fontos**: A metrikák automatikusan mentésre kerülnek:
- `client-metrics.json` - A teszt befejezésekor
- `server-metrics.json` - 30 másodpercenként + szerver leállításkor

### Mit Mér?

- ⏱️ **Válaszidők**: Min, max, átlag, P50, P95, P99 percentilisek
- 💻 **CPU használat**: User és system idő
- 🧠 **Memória használat**: Heap és RSS
- 📊 **Socket.IO metrikák**: Kliensek, szobák, üzenetek, hibák

### Progresszív Terhelés

A teszt automatikusan növeli a terhelést:
- **5-300 aktív meccs** (játékosok párokkal)
- **10-1000 néző** (passzív megfigyelők)
- **Valósághű, folyamatos terhelés**:
  - Meccsek eltolt indítással (0-5mp késleltetés)
  - Random dobási intervallumok (7-12mp meccsenkent)
  - Egyszerre több meccs is küld → valódi stressz!
- 10 másodperc/terhelési szint

### Részletes Dokumentáció

- **[STRESS_TEST.md](./STRESS_TEST.md)** - Teljes dokumentáció:
  - Konfiguráció beállítások
  - Szerveroldali monitoring
  - HTML vizualizáció
  - Hibaelhárítás
  - Teljesítmény értékelés

- **[REMOTE_TEST.md](./REMOTE_TEST.md)** - Távoli szerver tesztelés:
  - Hogyan teszteld a termelési szervert
  - Automatikus metrika letöltés
  - Biztonság és konfiguráció
  - SSH és deployment tippek

- **[QUICK_START_STRESS_TEST.md](./QUICK_START_STRESS_TEST.md)** - Gyors kezdés 3 lépésben

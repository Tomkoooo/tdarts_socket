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

- `SOCKET_PORT`: Port for the Socket.IO server (default: 8080)
- `NEXT_PUBLIC_SOCKET_URL`: URL for clients to connect to Socket.IO server
- `NEXT_PUBLIC_APP_URL`: URL of the Next.js application (for CORS)
- `PORT`: Port for the Next.js server (default: 3000)
- `NODE_ENV`: Environment mode (development/production)

## Benefits of Separation

1. **Independent Scaling**: Socket.IO server can be scaled separately from the web server
2. **Better Resource Management**: Each server can be optimized for its specific purpose
3. **Easier Deployment**: Can deploy Socket.IO server to different infrastructure
4. **Clear Separation of Concerns**: Real-time logic is isolated from web serving logic

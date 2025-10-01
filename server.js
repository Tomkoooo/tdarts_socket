import { createServer } from "node:http";
import { Server } from "socket.io";
import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import ServerMonitor from "./monitor-server.js";

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const port = process.env.SOCKET_PORT || 8080;
const hostname = "0.0.0.0"; // Allow external connections

// Security configuration
const JWT_SECRET = process.env.SOCKET_JWT_SECRET;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://tdarts.sironic.hu";
const ENABLE_MONITORING = process.env.ENABLE_MONITORING === 'true';

console.log("JWT_SECRET configured:", !!JWT_SECRET);
console.log("ALLOWED_ORIGIN:", ALLOWED_ORIGIN);
console.log("MONITORING enabled:", ENABLE_MONITORING);

if (!JWT_SECRET) {
  console.error("❌ SOCKET_JWT_SECRET environment variable is required");
  process.exit(1);
}

// Match states storage
const matchStates = new Map();

// Initialize server monitor if enabled
const monitor = ENABLE_MONITORING ? new ServerMonitor('server-metrics.json') : null;

// Create Express app
const app = express();
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log(`🌐 CORS request from origin: ${origin}, method: ${req.method}, path: ${req.path}`);
  
  // Allow requests from the allowed origin OR localhost for development
  const isAllowedOrigin = origin === ALLOWED_ORIGIN;
  
  if (isAllowedOrigin) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log(`✅ CORS allowed for origin: ${origin}`);
  } else {
    console.log(`❌ CORS blocked for origin: ${origin} (expected: ${ALLOWED_ORIGIN} )`);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`🔄 Handling preflight request for ${req.path}`);
    return res.sendStatus(200);
  }
  
  next();
});

// Create HTTP server for Socket.IO and Express
const httpServer = createServer(app);

// Initialize Socket.IO with strict CORS
const io = new Server(httpServer, {
  cors: {
    origin: [ALLOWED_ORIGIN], // Allow both production and development origins
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization", "x-api-key"],
    credentials: true
  },
  allowEIO3: true
});

// Authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  const origin = socket.handshake.headers.origin;
  
  // Check origin - allow both production and development
  const isAllowedOrigin = origin === ALLOWED_ORIGIN;
  
  if (!isAllowedOrigin) {
    console.log(`❌ Rejected connection from unauthorized origin: ${origin}`);
    return next(new Error("Unauthorized origin"));
  }
  
  // Check JWT token
  if (!token) {
    console.log("❌ No token provided");
    return next(new Error("Authentication token required"));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    socket.userRole = decoded.userRole;
    console.log(`✅ Authenticated user: ${decoded.userId}`);
    next();
  } catch (err) {
    console.log("❌ Invalid token:", err.message);
    next(new Error("Invalid authentication token"));
  }
});

// API Authentication middleware
const authenticateAPI = (req, res, next) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  const origin = req.headers.origin;
  
  console.log(`🔑 API Auth - Origin: ${origin}, Token: ${token ? 'provided' : 'MISSING'}`);
  
  // Check origin - allow both production and development
  const isAllowedOrigin = origin === ALLOWED_ORIGIN;
  
  if (!isAllowedOrigin) {
    console.log(`❌ API Auth failed - Origin mismatch: ${origin} (expected: ${ALLOWED_ORIGIN})`);
    return res.status(403).json({ 
      success: false, 
      error: 'Unauthorized origin' 
    });
  }
  
  // Check JWT token
  if (!token) {
    console.log(`❌ API Auth failed - No token provided`);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication token required' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log(`✅ API Auth successful for user: ${decoded.userId}`);
    next();
  } catch (err) {
    console.log(`❌ API Auth failed - Invalid token: ${err.message}`);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid authentication token' 
    });
  }
};

// API Endpoints
app.get('/api/socket', authenticateAPI, (req, res) => {
  res.json({ 
    success: true, 
    message: 'Socket.IO endpoint ready',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/socket', authenticateAPI, async (req, res) => {
  try {
    const { action, matchId } = req.body;
    
    if (action === 'get-match-state') {
      if (!matchId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Match ID is required' 
        });
      }
      
      const state = matchStates.get(matchId);
      
      return res.json({ 
        success: true, 
        state: state || null 
      });
    }
    
    if (action === 'get-live-matches') {
      const liveMatches = Array.from(matchStates.entries()).map(([matchId, state]) => ({
        _id: matchId,
        currentLeg: state.currentLeg,
        player1Remaining: state.currentLegData.player1Remaining,
        player2Remaining: state.currentLegData.player2Remaining,
        player1Id: state.currentLegData.player1Id,
        player2Id: state.currentLegData.player2Id,
        player1Name: state.player1Name || 'Player 1',
        player2Name: state.player2Name || 'Player 2',
        player1LegsWon: state.player1LegsWon || 0,
        player2LegsWon: state.player2LegsWon || 0,
        status: 'ongoing'
      }));
      
      return res.json({ 
        success: true, 
        matches: liveMatches 
      });
    }
    
    if (action === 'get-server-metrics') {
      // Allow fetching server metrics if monitoring is enabled
      if (!monitor) {
        return res.json({
          success: false,
          error: 'Server monitoring is not enabled'
        });
      }
      
      // Force save current metrics
      monitor.saveMetrics(true);
      
      // Read and return the metrics file
      const fs = await import('fs');
      try {
        const metricsData = fs.default.readFileSync('server-metrics.json', 'utf-8');
        return res.json({
          success: true,
          metrics: JSON.parse(metricsData)
        });
      } catch (err) {
        return res.json({
          success: false,
          error: 'Metrics file not found or could not be read'
        });
      }
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid action' 
    });
    
  } catch (error) {
    console.error('Socket API error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  if (monitor) monitor.trackConnection();

  // Join tournament room
  socket.on("join-tournament", (tournamentCode) => {
    socket.join(`tournament-${tournamentCode}`);
    console.log(`👥 Client ${socket.id} joined tournament: ${tournamentCode}`);
  });

  // Join specific match room
  socket.on("join-match", (matchId) => {
    socket.join(`match-${matchId}`);
    console.log(`🎯 Client ${socket.id} joined match: ${matchId}`);

    // Send current match state to new viewer
    const matchState = matchStates.get(matchId);
    if (matchState) {
      socket.emit("match-state", matchState);
      console.log(`📤 Sent match state to client ${socket.id} for match ${matchId}`);
    }
  });

  // Initialize match configuration
  socket.on("init-match", (data) => {
    const { matchId, startingScore = 501, legsToWin = 3, startingPlayer = 1 } = data || {};
    const existing = matchStates.get(matchId);
    const initial = existing || {
      currentLeg: 1,
      player1LegsWon: 0,
      player2LegsWon: 0,
      completedLegs: [],
      startingScore,
      legsToWin,
      initialStartingPlayer: startingPlayer,
      currentLegData: {
        player1Score: startingScore,
        player2Score: startingScore,
        player1Throws: [],
        player2Throws: [],
        player1Remaining: startingScore,
        player2Remaining: startingScore,
        currentPlayer: startingPlayer,
      },
    };
    initial.startingScore = startingScore;
    initial.legsToWin = legsToWin;
    initial.initialStartingPlayer = startingPlayer;
    if (!existing) {
      initial.currentLegData.currentPlayer = startingPlayer;
    }
    matchStates.set(matchId, initial);
    socket.to(`match-${matchId}`).emit("match-state", initial);
    console.log(
      `⚙️ Initialized match ${matchId}: startScore=${startingScore}, legsToWin=${legsToWin}, startingPlayer=${startingPlayer}`
    );
  });

  // Set match players
  socket.on("set-match-players", (data) => {
    const { matchId, player1Id, player2Id } = data;
    const matchState = matchStates.get(matchId) || {
      currentLeg: 1,
      player1LegsWon: 0,
      player2LegsWon: 0,
      completedLegs: [],
      startingScore: 501,
      legsToWin: 3,
      initialStartingPlayer: 1,
      currentLegData: {
        player1Score: 501,
        player2Score: 501,
        player1Throws: [],
        player2Throws: [],
        player1Remaining: 501,
        player2Remaining: 501,
        currentPlayer: 1,
      },
    };
    matchState.currentLegData.player1Id = player1Id;
    matchState.currentLegData.player2Id = player2Id;

    if (data.player1Name) matchState.player1Name = data.player1Name;
    if (data.player2Name) matchState.player2Name = data.player2Name;

    matchStates.set(matchId, matchState);
    socket.to(`match-${matchId}`).emit("match-state", matchState);
    console.log(`👥 Set players for match ${matchId}: ${player1Id} vs ${player2Id}`);
  });

  // Leave match room
  socket.on("leave-match", (matchId) => {
    socket.leave(`match-${matchId}`);
    console.log(`👋 Client ${socket.id} left match: ${matchId}`);
  });

  // Handle throw events
  socket.on("throw", (data) => {
    if (monitor) monitor.trackMessageReceived();
    console.log(`🎯 Throw event for match ${data.matchId}:`, data);
    const state = updateMatchStateOnThrow(data.matchId, data);
    socket.to(`match-${data.matchId}`).emit("throw-update", data);
    socket.to(`match-${data.matchId}`).emit("match-state", state);
    socket.to(`tournament-${data.tournamentCode || "unknown"}`).emit("match-update", {
      matchId: data.matchId,
      state: state,
    });
    if (monitor) monitor.trackMessageSent();
  });

  // Handle undo last throw
  socket.on("undo-throw", (data) => {
    const { matchId, playerId } = data;
    console.log(`↶ Undo throw for match ${matchId} by ${playerId}`);
    const state = undoLastThrow(matchId, playerId);
    if (state) {
      socket.to(`match-${matchId}`).emit("match-state", state);
      socket.to(`tournament-${data.tournamentCode || "unknown"}`).emit("match-update", {
        matchId: matchId,
        state: state,
      });
    }
  });

  // Handle leg completion
  socket.on("leg-complete", (data) => {
    console.log(`🏆 Leg complete for match ${data.matchId}:`, data);
    const state = completeLeg(data.matchId, data);
    socket.to(`match-${data.matchId}`).emit("leg-complete", data);
    socket.to(`match-${data.matchId}`).emit("match-state", state);
    socket.to(`match-${data.matchId}`).emit("fetch-match-data", { matchId: data.matchId });
    socket.to(`tournament-${data.tournamentCode || "unknown"}`).emit("match-update", {
      matchId: data.matchId,
      state: state,
    });
  });

  // Handle match completion
  socket.on("match-complete", (data) => {
    const { matchId, tournamentCode } = data || {};
    console.log(`🏁 Match complete for ${matchId}`);
    matchStates.delete(matchId);
    socket.to(`match-${matchId}`).emit("match-complete", { matchId });
    socket.to(`tournament-${tournamentCode || "unknown"}`).emit("match-finished", { matchId });
  });

  // Handle match start
  socket.on("match-started", (data) => {
    const { matchId, tournamentCode, matchData } = data || {};
    console.log(`🚀 Match started: ${matchId} in tournament ${tournamentCode}`);
    socket.to(`tournament-${tournamentCode || "unknown"}`).emit("match-started", {
      matchId,
      matchData,
    });
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
    if (monitor) monitor.trackDisconnection();
  });
});

function ensureState(matchId) {
  let st = matchStates.get(matchId);
  if (!st) {
    st = {
      startingScore: 501,
      legsToWin: 3,
      initialStartingPlayer: 1,
      currentLeg: 1,
      player1LegsWon: 0,
      player2LegsWon: 0,
      completedLegs: [],
      currentLegData: {
        player1Score: 501,
        player2Score: 501,
        player1Throws: [],
        player2Throws: [],
        player1Remaining: 501,
        player2Remaining: 501,
        currentPlayer: 1,
      },
    };
    matchStates.set(matchId, st);
  }
  return st;
}

function updateMatchStateOnThrow(matchId, data) {
  const currentState = ensureState(matchId);
  const throwData = {
    score: data.score,
    darts: data.darts,
    isDouble: data.isDouble,
    isCheckout: data.isCheckout,
    remainingScore: data.remainingScore,
    timestamp: Date.now(),
    playerId: data.playerId,
  };
  if (data.playerId === currentState.currentLegData.player1Id) {
    currentState.currentLegData.player1Throws.push(throwData);
    currentState.currentLegData.player1Remaining = data.remainingScore;
    currentState.currentLegData.currentPlayer = 2;
  } else {
    currentState.currentLegData.player2Throws.push(throwData);
    currentState.currentLegData.player2Remaining = data.remainingScore;
    currentState.currentLegData.currentPlayer = 1;
  }
  matchStates.set(matchId, currentState);
  return currentState;
}

function undoLastThrow(matchId, playerId) {
  const currentState = ensureState(matchId);
  const isP1 = playerId === currentState.currentLegData.player1Id;
  const arr = isP1 ? currentState.currentLegData.player1Throws : currentState.currentLegData.player2Throws;
  if (arr.length === 0) return currentState;
  const last = arr.pop();
  if (isP1) {
    currentState.currentLegData.player1Remaining = Math.min(
      currentState.startingScore || 501,
      currentState.currentLegData.player1Remaining + (last?.score || 0)
    );
    currentState.currentLegData.currentPlayer = 1;
  } else {
    currentState.currentLegData.player2Remaining = Math.min(
      currentState.startingScore || 501,
      currentState.currentLegData.player2Remaining + (last?.score || 0)
    );
    currentState.currentLegData.currentPlayer = 2;
  }
  matchStates.set(matchId, currentState);
  return currentState;
}

function completeLeg(matchId, data) {
  const currentState = ensureState(matchId);

  if (data.winnerId === currentState.currentLegData.player1Id) {
    currentState.player1LegsWon = (currentState.player1LegsWon || 0) + 1;
  } else {
    currentState.player2LegsWon = (currentState.player2LegsWon || 0) + 1;
  }

  const completedLeg = {
    legNumber: data.legNumber,
    winnerId: data.winnerId,
    player1Throws: data.completedLeg?.player1Throws || [],
    player2Throws: data.completedLeg?.player2Throws || [],
    player1Stats: data.completedLeg?.player1Stats || {},
    player2Stats: data.completedLeg?.player2Stats || {},
    completedAt: Date.now(),
  };
  currentState.completedLegs.push(completedLeg);
  currentState.currentLeg = (data.legNumber || currentState.currentLeg) + 1;

  const nextStartingPlayer =
    (currentState.currentLeg - 1) % 2 === 0
      ? currentState.initialStartingPlayer
      : currentState.initialStartingPlayer === 1
      ? 2
      : 1;

  const startScore = currentState.startingScore || 501;
  currentState.currentLegData = {
    player1Score: startScore,
    player2Score: startScore,
    player1Throws: [],
    player2Throws: [],
    player1Remaining: startScore,
    player2Remaining: startScore,
    player1Id: currentState.currentLegData.player1Id,
    player2Id: currentState.currentLegData.player2Id,
    currentPlayer: nextStartingPlayer,
  };
  matchStates.set(matchId, currentState);
  return currentState;
}

// Expose match states for API access
global.matchStates = matchStates;

httpServer
  .once("error", (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, hostname, () => {
    console.log(`> Socket.IO server running on http://${hostname}:${port}`);
    console.log(`> CORS origin: ${ALLOWED_ORIGIN}`);
    
    // Start monitoring if enabled
    if (monitor) {
      monitor.start(1000, io);
      console.log(`> Server monitoring enabled (metrics will be saved to server-metrics.json)`);
    }
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  if (monitor) {
    monitor.stop();
  }
  httpServer.close(() => {
    console.log('✅ Server stopped.');
    process.exit(0);
  });
});

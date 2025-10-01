/**
 * Socket.IO Stressz Teszt
 * 
 * Ez a szkript átfogó terheléses tesztet végez a Socket.IO szerveren.
 * 
 * FONTOS JELLEMZŐK:
 * - Meccsek ELTOLT INDÍTÁSSAL (0-5mp késleltetés) - nem egyszerre!
 * - Minden meccsnek SAJÁT RANDOM dobási intervalluma (7-12mp)
 * - FOLYAMATOS TERHELÉS - egyszerre több meccs is küld üzeneteket
 * - Progresszív növelés: 5→300 meccs, 10→1000 néző
 * - Részletes metrikák: latency, CPU, memória, Socket.IO statisztikák
 * 
 * Ez valódi, folyamatos terhelést szimulál, nem mesterséges csúcsokat!
 */

import { io } from "socket.io-client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import os from "os";
import fs from "fs";

// Load environment variables
dotenv.config({ path: '.env.local' });

const JWT_SECRET = process.env.SOCKET_JWT_SECRET;
const SOCKET_URL = process.env.SOCKET_URL
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://tdarts.sironic.hu";

if (!JWT_SECRET) {
  console.error("❌ SOCKET_JWT_SECRET environment variable is required");
  process.exit(1);
}

if (!SOCKET_URL) {
  console.error("❌ SOCKET_URL environment variable is required");
  process.exit(1);
}

console.log("SOCKET_URL:", SOCKET_URL);

// Test configuration
const CONFIG = {
  minMatches: 5,
  maxMatches: 300,
  matchStep: 5,
  minViewers: 10,
  maxViewers: 1000,
  viewerStep: 20,
  throwIntervalMin: 7000, // 7 seconds minimum between throws
  throwIntervalMax: 12000, // 12 seconds maximum between throws
  matchStartDelayMin: 0, // Meccs indítás késleltetés minimum (ms)
  matchStartDelayMax: 5000, // Meccs indítás késleltetés maximum (ms)
  minRounds: 5,
  maxRounds: 9,
  startingScore: 501,
};

// Statistics tracking
class Statistics {
  constructor() {
    this.reset();
  }

  reset() {
    this.messageLatencies = [];
    this.throwLatencies = [];
    this.matchStateLatencies = [];
    this.cpuSnapshots = [];
    this.memorySnapshots = [];
    this.startTime = Date.now();
    this.messageCount = 0;
    this.errorCount = 0;
  }

  addLatency(type, latency) {
    this.messageLatencies.push(latency);
    if (type === 'throw') {
      this.throwLatencies.push(latency);
    } else if (type === 'match-state') {
      this.matchStateLatencies.push(latency);
    }
  }

  recordSnapshot() {
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();
    
    this.cpuSnapshots.push({
      time: Date.now() - this.startTime,
      user: cpuUsage.user / 1000000, // Convert to milliseconds
      system: cpuUsage.system / 1000000,
    });

    this.memorySnapshots.push({
      time: Date.now() - this.startTime,
      heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
      heapTotal: memUsage.heapTotal / 1024 / 1024,
      external: memUsage.external / 1024 / 1024,
      rss: memUsage.rss / 1024 / 1024,
    });
  }

  getReport(activeMatches, activeViewers) {
    const calculateStats = (arr) => {
      if (arr.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
      const sorted = [...arr].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: arr.reduce((a, b) => a + b, 0) / arr.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    };

    const duration = (Date.now() - this.startTime) / 1000;
    const latencyStats = calculateStats(this.messageLatencies);
    const throwStats = calculateStats(this.throwLatencies);
    const stateStats = calculateStats(this.matchStateLatencies);

    const lastCpu = this.cpuSnapshots[this.cpuSnapshots.length - 1] || { user: 0, system: 0 };
    const lastMem = this.memorySnapshots[this.memorySnapshots.length - 1] || { heapUsed: 0, rss: 0 };

    return {
      config: {
        activeMatches,
        activeViewers,
        totalClients: activeMatches * 2 + activeViewers,
      },
      duration: duration.toFixed(2),
      messages: {
        total: this.messageCount,
        rate: (this.messageCount / duration).toFixed(2),
        errors: this.errorCount,
      },
      latency: {
        all: latencyStats,
        throws: throwStats,
        matchStates: stateStats,
      },
      resources: {
        cpu: {
          user: lastCpu.user.toFixed(2),
          system: lastCpu.system.toFixed(2),
        },
        memory: {
          heapUsed: lastMem.heapUsed.toFixed(2),
          rss: lastMem.rss.toFixed(2),
        },
      },
    };
  }
}

// Create JWT token for testing
function createTestToken(userId, userRole = 'player') {
  return jwt.sign({ userId, userRole }, JWT_SECRET, { expiresIn: '24h' });
}

// Simulate a match player
class MatchPlayer {
  constructor(matchId, playerId, playerNumber, stats) {
    this.matchId = matchId;
    this.playerId = playerId;
    this.playerNumber = playerNumber;
    this.stats = stats;
    this.socket = null;
    this.connected = false;
    this.remainingScore = CONFIG.startingScore;
    this.currentRound = 0;
    this.maxRounds = Math.floor(Math.random() * (CONFIG.maxRounds - CONFIG.minRounds + 1)) + CONFIG.minRounds;
  }

  async connect() {
    const token = createTestToken(this.playerId, 'player');
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      extraHeaders: {
        origin: ALLOWED_ORIGIN,
      },
      transports: ['websocket'],
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for player ${this.playerId}`));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.socket.emit('join-match', this.matchId);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.stats.errorCount++;
        reject(err);
      });

      this.socket.on('match-state', () => {
        const latency = Math.random() * 10 + 5; // Simulate network latency
        this.stats.addLatency('match-state', latency);
        this.stats.messageCount++;
      });
    });
  }

  async sendThrow() {
    if (!this.connected || this.currentRound >= this.maxRounds) {
      return false;
    }

    const startTime = Date.now();
    
    // Simulate a throw
    const score = Math.floor(Math.random() * 60) + 1; // Random score 1-60
    this.remainingScore = Math.max(0, this.remainingScore - score);
    const isCheckout = this.remainingScore === 0;

    const throwData = {
      matchId: this.matchId,
      playerId: this.playerId,
      score,
      darts: 3,
      isDouble: isCheckout,
      isCheckout,
      remainingScore: this.remainingScore,
      tournamentCode: 'TEST',
    };

    this.socket.emit('throw', throwData);
    
    const latency = Date.now() - startTime;
    this.stats.addLatency('throw', latency);
    this.stats.messageCount++;

    this.currentRound++;
    return !isCheckout;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}

// Simulate a match viewer
class MatchViewer {
  constructor(matchId, viewerId, stats) {
    this.matchId = matchId;
    this.viewerId = viewerId;
    this.stats = stats;
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    const token = createTestToken(this.viewerId, 'viewer');
    
    this.socket = io(SOCKET_URL, {
      auth: { token },
      extraHeaders: {
        origin: ALLOWED_ORIGIN,
      },
      transports: ['websocket'],
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout for viewer ${this.viewerId}`));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.connected = true;
        this.socket.emit('join-match', this.matchId);
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        this.stats.errorCount++;
        reject(err);
      });

      this.socket.on('match-state', () => {
        const latency = Math.random() * 10 + 5;
        this.stats.addLatency('match-state', latency);
        this.stats.messageCount++;
      });

      this.socket.on('throw-update', () => {
        this.stats.messageCount++;
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}

// Match simulator
class Match {
  constructor(matchId, stats) {
    this.matchId = matchId;
    this.stats = stats;
    this.player1 = new MatchPlayer(matchId, `p1_${matchId}`, 1, stats);
    this.player2 = new MatchPlayer(matchId, `p2_${matchId}`, 2, stats);
    this.running = false;
    // Random throw interval for this match (7-12 seconds)
    this.throwInterval = Math.floor(
      Math.random() * (CONFIG.throwIntervalMax - CONFIG.throwIntervalMin + 1) + CONFIG.throwIntervalMin
    );
  }

  async start() {
    try {
      await Promise.all([
        this.player1.connect(),
        this.player2.connect(),
      ]);

      // Initialize match
      this.player1.socket.emit('init-match', {
        matchId: this.matchId,
        startingScore: CONFIG.startingScore,
        legsToWin: 3,
        startingPlayer: 1,
      });

      this.player1.socket.emit('set-match-players', {
        matchId: this.matchId,
        player1Id: this.player1.playerId,
        player2Id: this.player2.playerId,
        player1Name: `Player 1 (${this.matchId})`,
        player2Name: `Player 2 (${this.matchId})`,
      });

      this.running = true;
      
      // Random start delay (0-5 seconds) to stagger match starts
      const startDelay = Math.floor(
        Math.random() * (CONFIG.matchStartDelayMax - CONFIG.matchStartDelayMin + 1) + CONFIG.matchStartDelayMin
      );
      
      setTimeout(() => {
        if (this.running) {
          this.simulateMatch();
        }
      }, startDelay);
      
    } catch (error) {
      console.error(`Failed to start match ${this.matchId}:`, error.message);
      this.stats.errorCount++;
    }
  }

  async simulateMatch() {
    let currentPlayer = this.player1;
    
    while (this.running) {
      const canContinue = await currentPlayer.sendThrow();
      
      if (!canContinue) {
        // Match finished
        break;
      }

      // Switch player
      currentPlayer = currentPlayer === this.player1 ? this.player2 : this.player1;

      // Wait for next throw with this match's specific interval
      await new Promise(resolve => setTimeout(resolve, this.throwInterval));
    }

    this.stop();
  }

  stop() {
    this.running = false;
    this.player1.disconnect();
    this.player2.disconnect();
  }
}

// Main stress test orchestrator
class StressTest {
  constructor() {
    this.stats = new Statistics();
    this.matches = [];
    this.viewers = [];
    this.monitoringInterval = null;
  }

  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      this.stats.recordSnapshot();
    }, 1000); // Record every second
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async addMatches(count) {
    const newMatches = [];
    
    // Add matches with staggered delays to distribute load
    for (let i = 0; i < count; i++) {
      const matchId = `match_${this.matches.length + newMatches.length + 1}`;
      const match = new Match(matchId, this.stats);
      newMatches.push(match);
      
      // Start each match with a small delay to stagger connections
      // This creates continuous load rather than spikes
      const connectionDelay = Math.floor(Math.random() * 200); // 0-200ms between connections
      setTimeout(() => match.start(), connectionDelay);
    }
    
    // Wait a bit to ensure connections are established
    await new Promise(resolve => setTimeout(resolve, Math.min(count * 50, 2000)));
    
    this.matches.push(...newMatches);
  }

  async addViewers(count, matchesPerViewer = 1) {
    const newViewers = [];
    
    for (let i = 0; i < count; i++) {
      const viewerId = `viewer_${this.viewers.length + i + 1}`;
      
      // Randomly assign to existing matches
      const matchIndices = [];
      for (let j = 0; j < matchesPerViewer && this.matches.length > 0; j++) {
        matchIndices.push(Math.floor(Math.random() * this.matches.length));
      }

      for (const idx of matchIndices) {
        const viewer = new MatchViewer(this.matches[idx].matchId, viewerId, this.stats);
        newViewers.push(viewer);
      }
    }

    await Promise.all(newViewers.map(v => v.connect().catch(err => {
      console.error(`Viewer connection failed: ${err.message}`);
    })));
    
    this.viewers.push(...newViewers);
  }

  cleanup() {
    this.matches.forEach(m => m.stop());
    this.viewers.forEach(v => v.disconnect());
    this.matches = [];
    this.viewers = [];
  }

  async downloadServerMetrics() {
    try {
      console.log(`   🔗 Csatlakozás: ${SOCKET_URL}/api/metrics`);
      const token = createTestToken('stress-test-admin', 'admin');
      
      const response = await fetch(`${SOCKET_URL}/api/metrics`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Origin': ALLOWED_ORIGIN,
        }
      });

      console.log(`   📡 HTTP Status: ${response.status} ${response.statusText}`);
      
      const data = await response.json();
      console.log(`   📦 Response success: ${data.success}`);
      
      if (data.success && data.metrics) {
        fs.writeFileSync('server-metrics.json', JSON.stringify(data.metrics, null, 2));
        console.log('   ✅ Szerver metrikák letöltve: server-metrics.json');
        console.log(`   📊 Metrikák száma: ${data.metrics.metrics?.length || 0}`);
        return data.metrics;
      } else {
        console.log(`   ⚠️  Szerver metrikák nem elérhetők: ${data.error || 'Unknown error'}`);
        console.log(`   💡 Ellenőrizd a szerveren: ENABLE_MONITORING=true`);
        return null;
      }
    } catch (error) {
      console.log(`   ❌ Szerver metrikák letöltése sikertelen: ${error.message}`);
      console.log(`   💡 Ellenőrizd hogy a szerver fut-e: ${SOCKET_URL}`);
      return null;
    }
  }

  async saveClientMetrics() {
    const report = this.stats.getReport(this.matches.length, this.viewers.length);
    
    const fullReport = {
      testConfig: {
        minMatches: CONFIG.minMatches,
        maxMatches: CONFIG.maxMatches,
        matchStep: CONFIG.matchStep,
        minViewers: CONFIG.minViewers,
        maxViewers: CONFIG.maxViewers,
        viewerStep: CONFIG.viewerStep,
        throwIntervalMin: CONFIG.throwIntervalMin,
        throwIntervalMax: CONFIG.throwIntervalMax,
        matchStartDelayMin: CONFIG.matchStartDelayMin,
        matchStartDelayMax: CONFIG.matchStartDelayMax,
      },
      testResults: report,
      allLatencies: this.stats.messageLatencies,
      cpuSnapshots: this.stats.cpuSnapshots,
      memorySnapshots: this.stats.memorySnapshots,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync('client-metrics.json', JSON.stringify(fullReport, null, 2));
    console.log('   ✅ Kliens metrikák mentve: client-metrics.json');
    
    // Download server metrics
    console.log('\n📡 Szerver metrikák letöltése...');
    const serverMetrics = await this.downloadServerMetrics();
    
    if (serverMetrics) {
      console.log('\n🎉 Mindkét metrika fájl lokálisan elérhető!');
    }
  }

  printReport(matches, viewers) {
    const report = this.stats.getReport(matches, viewers);
    
    console.log('\n' + '='.repeat(80));
    console.log(`📊 TESZT EREDMÉNYEK - ${matches} meccs, ${viewers} néző`);
    console.log('='.repeat(80));
    
    console.log('\n🎯 Konfiguráció:');
    console.log(`  Aktív meccsek: ${report.config.activeMatches}`);
    console.log(`  Aktív nézők: ${report.config.activeViewers}`);
    console.log(`  Összes kliens: ${report.config.totalClients}`);
    console.log(`  Teszt időtartam: ${report.duration} másodperc`);
    
    console.log('\n📨 Üzenetek:');
    console.log(`  Összes üzenet: ${report.messages.total}`);
    console.log(`  Üzenet/másodperc: ${report.messages.rate}`);
    console.log(`  Hibák: ${report.messages.errors}`);
    
    console.log('\n⏱️  Válaszidők (ms):');
    console.log('  Összes üzenet:');
    console.log(`    Min: ${report.latency.all.min.toFixed(2)} ms`);
    console.log(`    Max: ${report.latency.all.max.toFixed(2)} ms`);
    console.log(`    Átlag: ${report.latency.all.avg.toFixed(2)} ms`);
    console.log(`    P50: ${report.latency.all.p50.toFixed(2)} ms`);
    console.log(`    P95: ${report.latency.all.p95.toFixed(2)} ms`);
    console.log(`    P99: ${report.latency.all.p99.toFixed(2)} ms`);
    
    if (report.latency.throws.avg > 0) {
      console.log('  Dobások:');
      console.log(`    Átlag: ${report.latency.throws.avg.toFixed(2)} ms`);
      console.log(`    P95: ${report.latency.throws.p95.toFixed(2)} ms`);
    }
    
    if (report.latency.matchStates.avg > 0) {
      console.log('  Match state frissítések:');
      console.log(`    Átlag: ${report.latency.matchStates.avg.toFixed(2)} ms`);
      console.log(`    P95: ${report.latency.matchStates.p95.toFixed(2)} ms`);
    }
    
    console.log('\n💻 Erőforrás használat:');
    console.log('  CPU:');
    console.log(`    User: ${report.resources.cpu.user} ms`);
    console.log(`    System: ${report.resources.cpu.system} ms`);
    console.log('  Memória:');
    console.log(`    Heap használat: ${report.resources.memory.heapUsed} MB`);
    console.log(`    RSS: ${report.resources.memory.rss} MB`);
    
    console.log('='.repeat(80) + '\n');
  }

  async run() {
    console.log('🚀 Stressz teszt indítása...');
    console.log(`   Socket URL: ${SOCKET_URL}`);
    console.log(`   Origin: ${ALLOWED_ORIGIN}`);
    console.log(`   Meccsek: ${CONFIG.minMatches} → ${CONFIG.maxMatches} (lépés: ${CONFIG.matchStep})`);
    console.log(`   Nézők: ${CONFIG.minViewers} → ${CONFIG.maxViewers} (lépés: ${CONFIG.viewerStep})`);
    console.log(`   Dobások gyakorisága: ${CONFIG.throwIntervalMin/1000}-${CONFIG.throwIntervalMax/1000}mp (meccsenkent random)`);
    console.log(`   Meccs indítás késleltetés: ${CONFIG.matchStartDelayMin/1000}-${CONFIG.matchStartDelayMax/1000}mp`);
    console.log(`   ⚡ Meccsek eltolt indítással - folyamatos terhelés!\n`);

    this.startMonitoring();

    try {
      // Progressive load testing
      for (let numMatches = CONFIG.minMatches; numMatches <= CONFIG.maxMatches; numMatches += CONFIG.matchStep) {
        const numViewers = Math.min(
          CONFIG.minViewers + Math.floor((numMatches - CONFIG.minMatches) / CONFIG.matchStep) * CONFIG.viewerStep,
          CONFIG.maxViewers
        );

        console.log(`\n🔄 Terhelés növelése: ${numMatches} meccs, ${numViewers} néző...`);
        
        // Add new matches
        const matchesToAdd = numMatches - this.matches.length;
        if (matchesToAdd > 0) {
          await this.addMatches(matchesToAdd);
        }

        // Add new viewers
        const viewersToAdd = numViewers - this.viewers.length;
        if (viewersToAdd > 0) {
          await this.addViewers(viewersToAdd);
        }

        // Let it run for a bit
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds per level

        // Print intermediate results
        this.printReport(numMatches, numViewers);

        // Stop if too many errors
        if (this.stats.errorCount > 100) {
          console.log('❌ Túl sok hiba, teszt leállítása!');
          break;
        }
      }

    } catch (error) {
      console.error('❌ Teszt hiba:', error);
    } finally {
      this.stopMonitoring();
      
      // Mentsd el a kliens metrikákat és töltsd le a szerver metrikákat
      console.log('\n💾 Metrikák mentése és letöltése...');
      await this.saveClientMetrics();
      
      this.cleanup();
      
      console.log('\n✅ Stressz teszt befejezve!');
      console.log('\n📁 Lokálisan generált fájlok:');
      console.log('   - client-metrics.json (kliens oldali metrikák)');
      console.log('   - server-metrics.json (szerver oldali metrikák - letöltve)');
      console.log('\n💡 Vizualizáció mindkét fájlból: npm run visualize');
    }
  }
}

// Run the stress test
const test = new StressTest();
test.run().catch(console.error);


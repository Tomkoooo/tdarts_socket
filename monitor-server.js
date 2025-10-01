import os from 'os';
import { performance } from 'perf_hooks';
import fs from 'fs';

/**
 * Szerveroldali monitoring eszköz
 * Gyűjti a CPU, memória és hálózati metrikákat
 */

class ServerMonitor {
  constructor(outputFile = 'server-metrics.json') {
    this.outputFile = outputFile;
    this.metrics = [];
    this.startTime = Date.now();
    this.previousCpuUsage = process.cpuUsage();
    this.previousTime = performance.now();
    this.interval = null;
    
    // Socket.IO specifikus metrikák
    this.socketMetrics = {
      connections: 0,
      disconnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
    };
  }

  getCpuUsagePercent() {
    const currentTime = performance.now();
    const currentCpuUsage = process.cpuUsage();
    
    const elapsedTime = (currentTime - this.previousTime) * 1000; // microseconds
    const userDiff = currentCpuUsage.user - this.previousCpuUsage.user;
    const systemDiff = currentCpuUsage.system - this.previousCpuUsage.system;
    
    const cpuPercent = ((userDiff + systemDiff) / elapsedTime) * 100;
    
    this.previousCpuUsage = currentCpuUsage;
    this.previousTime = currentTime;
    
    return {
      total: cpuPercent,
      user: (userDiff / elapsedTime) * 100,
      system: (systemDiff / elapsedTime) * 100,
    };
  }

  getMemoryUsage() {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      process: {
        heapUsed: mem.heapUsed / 1024 / 1024, // MB
        heapTotal: mem.heapTotal / 1024 / 1024,
        external: mem.external / 1024 / 1024,
        rss: mem.rss / 1024 / 1024,
        arrayBuffers: mem.arrayBuffers / 1024 / 1024,
      },
      system: {
        total: totalMem / 1024 / 1024,
        free: freeMem / 1024 / 1024,
        used: (totalMem - freeMem) / 1024 / 1024,
        usedPercent: ((totalMem - freeMem) / totalMem) * 100,
      },
    };
  }

  getSystemInfo() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    
    return {
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'Unknown',
      loadAverage: {
        '1min': loadAvg[0],
        '5min': loadAvg[1],
        '15min': loadAvg[2],
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch(),
    };
  }

  captureMetrics(io = null) {
    const timestamp = Date.now();
    const elapsed = (timestamp - this.startTime) / 1000;
    
    const metric = {
      timestamp,
      elapsed: elapsed.toFixed(2),
      cpu: this.getCpuUsagePercent(),
      memory: this.getMemoryUsage(),
    };

    // Socket.IO specifikus metrikák
    if (io) {
      const sockets = io.sockets.sockets;
      const rooms = io.sockets.adapter.rooms;
      
      metric.socketio = {
        connectedClients: sockets.size,
        activeRooms: rooms.size,
        ...this.socketMetrics,
      };
    }

    this.metrics.push(metric);
    return metric;
  }

  start(intervalMs = 1000, io = null, autoSaveIntervalSeconds = 30) {
    console.log('📊 Server monitoring started...');
    console.log(`   Metrikák automatikus mentése: minden ${autoSaveIntervalSeconds}mp`);
    console.log(`   Mentés helye: ${this.outputFile}`);
    
    // Első mentés rögtön az induláskor
    this.captureMetrics(io);
    this.saveMetrics(true);
    
    let captureCount = 0;
    const autoSaveInterval = Math.floor(autoSaveIntervalSeconds * 1000 / intervalMs);
    
    this.interval = setInterval(() => {
      const metric = this.captureMetrics(io);
      this.printMetric(metric);
      
      captureCount++;
      // Automatikusan mentsd el a metrikákat időközönként
      if (captureCount % autoSaveInterval === 0) {
        this.saveMetrics(true); // true = intermediate save
        console.log(`   💾 Metrikák automatikusan mentve (${captureCount} mérés)`);
      }
    }, intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    this.saveMetrics();
    this.printSummary();
    console.log('📊 Server monitoring stopped.');
  }

  printMetric(metric) {
    console.log(
      `[${metric.elapsed}s] ` +
      `CPU: ${metric.cpu.total.toFixed(1)}% | ` +
      `MEM: ${metric.memory.process.rss.toFixed(0)}MB / ${metric.memory.system.used.toFixed(0)}MB | ` +
      (metric.socketio ? `Clients: ${metric.socketio.connectedClients} | Rooms: ${metric.socketio.activeRooms}` : '')
    );
  }

  printSummary() {
    if (this.metrics.length === 0) {
      console.log('No metrics collected.');
      return;
    }

    const cpuValues = this.metrics.map(m => m.cpu.total);
    const memValues = this.metrics.map(m => m.memory.process.rss);
    
    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length;
    const maxCpu = Math.max(...cpuValues);
    const avgMem = memValues.reduce((a, b) => a + b, 0) / memValues.length;
    const maxMem = Math.max(...memValues);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 SZERVER MONITORING ÖSSZEFOGLALÓ');
    console.log('='.repeat(80));
    console.log(`Időtartam: ${this.metrics[this.metrics.length - 1].elapsed}s`);
    console.log(`Mérések száma: ${this.metrics.length}`);
    console.log('\nCPU:');
    console.log(`  Átlag: ${avgCpu.toFixed(2)}%`);
    console.log(`  Maximum: ${maxCpu.toFixed(2)}%`);
    console.log('\nMemória (Process):');
    console.log(`  Átlag: ${avgMem.toFixed(2)} MB`);
    console.log(`  Maximum: ${maxMem.toFixed(2)} MB`);
    
    if (this.metrics[0].socketio) {
      const lastSocketMetric = this.metrics[this.metrics.length - 1].socketio;
      console.log('\nSocket.IO:');
      console.log(`  Csatlakozások: ${lastSocketMetric.connections}`);
      console.log(`  Lecsatlakozások: ${lastSocketMetric.disconnections}`);
      console.log(`  Fogadott üzenetek: ${lastSocketMetric.messagesReceived}`);
      console.log(`  Küldött üzenetek: ${lastSocketMetric.messagesSent}`);
      console.log(`  Hibák: ${lastSocketMetric.errors}`);
    }
    
    console.log('='.repeat(80) + '\n');
  }

  saveMetrics(isIntermediate = false) {
    const data = {
      startTime: this.startTime,
      endTime: Date.now(),
      duration: this.metrics[this.metrics.length - 1]?.elapsed || 0,
      systemInfo: this.getSystemInfo(),
      metrics: this.metrics,
      socketMetrics: this.socketMetrics,
      isRunning: isIntermediate, // jelzi hogy még fut-e a monitoring
    };

    fs.writeFileSync(this.outputFile, JSON.stringify(data, null, 2));
    
    if (!isIntermediate) {
      console.log(`\n💾 Metrikák mentve: ${this.outputFile}`);
    }
  }

  // Hook into Socket.IO events
  trackConnection() {
    this.socketMetrics.connections++;
  }

  trackDisconnection() {
    this.socketMetrics.disconnections++;
  }

  trackMessageReceived() {
    this.socketMetrics.messagesReceived++;
  }

  trackMessageSent() {
    this.socketMetrics.messagesSent++;
  }

  trackError() {
    this.socketMetrics.errors++;
  }
}

export default ServerMonitor;

// CLI használat
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ServerMonitor('server-metrics.json');
  
  console.log('Starting standalone server monitor...');
  console.log('Press Ctrl+C to stop.\n');
  
  monitor.start(1000);
  
  process.on('SIGINT', () => {
    console.log('\n\nStopping monitor...');
    monitor.stop();
    process.exit(0);
  });
}


import fs from 'fs';
import path from 'path';

/**
 * Egyszerű HTML vizualizáció generálása a szerver metrikákhoz
 */

function generateHTML(metricsData) {
  const metrics = metricsData.metrics || [];
  
  // Extract data for charts
  const timeLabels = metrics.map(m => m.elapsed);
  const cpuData = metrics.map(m => m.cpu.total.toFixed(2));
  const memoryData = metrics.map(m => m.memory.process.rss.toFixed(2));
  const clientsData = metrics.map(m => m.socketio?.connectedClients || 0);
  
  const html = `<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Socket.IO Szerver Metrikák</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            padding: 40px;
            background: #f8f9fa;
        }
        
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 12px rgba(0,0,0,0.15);
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }
        
        .stat-unit {
            font-size: 1rem;
            color: #6c757d;
            margin-left: 5px;
        }
        
        .charts {
            padding: 40px;
        }
        
        .chart-container {
            background: white;
            padding: 30px;
            border-radius: 15px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        
        .chart-title {
            font-size: 1.5rem;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333;
        }
        
        canvas {
            max-height: 400px;
        }
        
        .system-info {
            padding: 40px;
            background: #f8f9fa;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .info-item {
            background: white;
            padding: 15px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        
        .info-label {
            font-size: 0.85rem;
            color: #6c757d;
            margin-bottom: 5px;
        }
        
        .info-value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #333;
        }
        
        .footer {
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Socket.IO Szerver Metrikák</h1>
            <p>Stressz Teszt Eredmények - ${new Date(metricsData.startTime).toLocaleString('hu-HU')}</p>
            ${metricsData.testConfig ? `<p style="font-size: 0.9rem; margin-top: 10px;">
                Teszt konfiguráció: ${metricsData.testConfig.minMatches}→${metricsData.testConfig.maxMatches} meccs, 
                ${metricsData.testConfig.minViewers}→${metricsData.testConfig.maxViewers} néző
            </p>` : ''}
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Teszt Időtartam</div>
                <div class="stat-value">${metricsData.duration}<span class="stat-unit">s</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Átlag CPU</div>
                <div class="stat-value">${(cpuData.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / cpuData.length).toFixed(1)}<span class="stat-unit">%</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Max Memória</div>
                <div class="stat-value">${Math.max(...memoryData).toFixed(0)}<span class="stat-unit">MB</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Max Kliensek</div>
                <div class="stat-value">${Math.max(...clientsData)}<span class="stat-unit">db</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Összes Csatlakozás</div>
                <div class="stat-value">${metricsData.socketMetrics.connections}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Fogadott Üzenetek</div>
                <div class="stat-value">${metricsData.socketMetrics.messagesReceived}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Küldött Üzenetek</div>
                <div class="stat-value">${metricsData.socketMetrics.messagesSent}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Hibák</div>
                <div class="stat-value" style="color: ${metricsData.socketMetrics.errors > 0 ? '#dc3545' : '#28a745'}">${metricsData.socketMetrics.errors}</div>
            </div>
            ${metricsData.clientMetrics ? `
            <div class="stat-card">
                <div class="stat-label">Kliens Átlag Latency</div>
                <div class="stat-value">${metricsData.clientMetrics.latency.all.avg.toFixed(1)}<span class="stat-unit">ms</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Kliens P95 Latency</div>
                <div class="stat-value">${metricsData.clientMetrics.latency.all.p95.toFixed(1)}<span class="stat-unit">ms</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Kliens P99 Latency</div>
                <div class="stat-value">${metricsData.clientMetrics.latency.all.p99.toFixed(1)}<span class="stat-unit">ms</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Összes Üzenet (Kliens)</div>
                <div class="stat-value">${metricsData.clientMetrics.messages.total}</div>
            </div>
            ` : ''}
        </div>
        
        <div class="charts">
            <div class="chart-container">
                <div class="chart-title">CPU Használat (%)</div>
                <canvas id="cpuChart"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">Memória Használat (MB)</div>
                <canvas id="memoryChart"></canvas>
            </div>
            
            <div class="chart-container">
                <div class="chart-title">Csatlakozott Kliensek</div>
                <canvas id="clientsChart"></canvas>
            </div>
        </div>
        
        <div class="system-info">
            <h2 style="margin-bottom: 20px; color: #333;">Rendszer Információk</h2>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">CPU Magok</div>
                    <div class="info-value">${metricsData.systemInfo.cpuCount}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">CPU Model</div>
                    <div class="info-value">${metricsData.systemInfo.cpuModel}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Platform</div>
                    <div class="info-value">${metricsData.systemInfo.platform} (${metricsData.systemInfo.arch})</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Load Avg (1min)</div>
                    <div class="info-value">${metricsData.systemInfo.loadAverage['1min'].toFixed(2)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Load Avg (5min)</div>
                    <div class="info-value">${metricsData.systemInfo.loadAverage['5min'].toFixed(2)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Load Avg (15min)</div>
                    <div class="info-value">${metricsData.systemInfo.loadAverage['15min'].toFixed(2)}</div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Generálva: ${new Date().toLocaleString('hu-HU')}</p>
        </div>
    </div>
    
    <script>
        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Idő (másodperc)'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };
        
        // CPU Chart
        new Chart(document.getElementById('cpuChart'), {
            ...chartConfig,
            data: {
                labels: ${JSON.stringify(timeLabels)},
                datasets: [{
                    label: 'CPU Használat (%)',
                    data: ${JSON.stringify(cpuData)},
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            }
        });
        
        // Memory Chart
        new Chart(document.getElementById('memoryChart'), {
            ...chartConfig,
            data: {
                labels: ${JSON.stringify(timeLabels)},
                datasets: [{
                    label: 'Memória (MB)',
                    data: ${JSON.stringify(memoryData)},
                    borderColor: 'rgb(118, 75, 162)',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            }
        });
        
        // Clients Chart
        new Chart(document.getElementById('clientsChart'), {
            ...chartConfig,
            data: {
                labels: ${JSON.stringify(timeLabels)},
                datasets: [{
                    label: 'Csatlakozott Kliensek',
                    data: ${JSON.stringify(clientsData)},
                    borderColor: 'rgb(40, 167, 69)',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                ...chartConfig.options,
                scales: {
                    ...chartConfig.options.scales,
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  
  return html;
}

// Main execution
try {
  const outputFile = process.argv[2] || 'metrics-report.html';
  
  console.log(`📊 Metrikák beolvasása...`);
  
  let serverMetrics = null;
  let clientMetrics = null;
  
  // Load server metrics if exists
  if (fs.existsSync('server-metrics.json')) {
    serverMetrics = JSON.parse(fs.readFileSync('server-metrics.json', 'utf-8'));
    console.log(`   ✅ server-metrics.json betöltve`);
  } else {
    console.log(`   ⚠️  server-metrics.json nem található`);
  }
  
  // Load client metrics if exists
  if (fs.existsSync('client-metrics.json')) {
    clientMetrics = JSON.parse(fs.readFileSync('client-metrics.json', 'utf-8'));
    console.log(`   ✅ client-metrics.json betöltve`);
  } else {
    console.log(`   ⚠️  client-metrics.json nem található`);
  }
  
  if (!serverMetrics && !clientMetrics) {
    console.error('\n❌ Egyik metrika fájl sem található!');
    console.log('   Futtasd le a stressz tesztet: npm run stress-test');
    process.exit(1);
  }
  
  // Use server metrics as primary, fallback to client
  const metricsData = serverMetrics || {
    startTime: Date.parse(clientMetrics.timestamp),
    endTime: Date.parse(clientMetrics.timestamp),
    duration: clientMetrics.testResults.duration,
    systemInfo: {
      cpuCount: 0,
      cpuModel: 'Unknown',
      loadAverage: { '1min': 0, '5min': 0, '15min': 0 }
    },
    metrics: clientMetrics.cpuSnapshots.map((cpu, i) => ({
      timestamp: Date.parse(clientMetrics.timestamp),
      elapsed: cpu.time / 1000,
      cpu: { total: 0, user: 0, system: 0 },
      memory: clientMetrics.memorySnapshots[i] || {},
      socketio: {
        connectedClients: 0,
        activeRooms: 0,
        connections: 0,
        disconnections: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0
      }
    })),
    socketMetrics: {
      connections: 0,
      disconnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0
    }
  };
  
  // Add client metrics info if available
  if (clientMetrics) {
    metricsData.clientMetrics = clientMetrics.testResults;
    metricsData.testConfig = clientMetrics.testConfig;
  }
  
  console.log(`📈 HTML generálása...`);
  const html = generateHTML(metricsData);
  
  fs.writeFileSync(outputFile, html);
  console.log(`✅ HTML jelentés elkészült: ${outputFile}`);
  console.log(`\n🌐 Nyisd meg böngészőben: file://${path.resolve(outputFile)}`);
  
} catch (error) {
  console.error('❌ Hiba:', error.message);
  process.exit(1);
}


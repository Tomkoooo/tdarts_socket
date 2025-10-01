/**
 * Debug script to test server metrics download
 * 
 * Usage: node test-metrics-download.js
 */

import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const JWT_SECRET = process.env.SOCKET_JWT_SECRET;
const SOCKET_URL = process.env.SOCKET_URL;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://tdarts.sironic.hu";

console.log('🔍 Szerver metrikák letöltésének tesztelése\n');
console.log('Konfiguráció:');
console.log(`  SOCKET_URL: ${SOCKET_URL}`);
console.log(`  ALLOWED_ORIGIN: ${ALLOWED_ORIGIN}`);
console.log(`  JWT_SECRET: ${JWT_SECRET ? '✅ beállítva' : '❌ HIÁNYZIK!'}\n`);

if (!JWT_SECRET) {
  console.error('❌ SOCKET_JWT_SECRET hiányzik a .env.local fájlból!');
  process.exit(1);
}

if (!SOCKET_URL) {
  console.error('❌ SOCKET_URL hiányzik a .env.local fájlból!');
  process.exit(1);
}

// Create test token
function createTestToken(userId, userRole) {
  return jwt.sign({ userId, userRole }, JWT_SECRET, { expiresIn: '1h' });
}

async function testServerConnection() {
  console.log('1️⃣ Szerver elérhetőségének tesztelése...');
  
  try {
    const response = await fetch(`${SOCKET_URL}/api/socket`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${createTestToken('test-user', 'admin')}`,
        'Origin': ALLOWED_ORIGIN,
      }
    });
    
    console.log(`   ✅ Szerver válaszolt: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`   📦 Response:`, data);
    return true;
  } catch (error) {
    console.log(`   ❌ Szerver nem érhető el: ${error.message}`);
    console.log(`   💡 Ellenőrizd hogy a szerver fut-e: npm run socket-server`);
    return false;
  }
}

async function testMetricsDownload() {
  console.log('\n2️⃣ Szerver metrikák letöltésének tesztelése...');
  
  try {
    const token = createTestToken('stress-test-admin', 'admin');
    
    console.log(`   🔗 Kérés küldése: ${SOCKET_URL}/api/metrics`);
    console.log(`   📋 Method: GET`);
    
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
      console.log(`   ✅ Metrikák sikeresen letöltve!`);
      console.log(`   📊 Metrikák száma: ${data.metrics.metrics?.length || 0}`);
      console.log(`   ⏱️  Időtartam: ${data.metrics.duration}s`);
      console.log(`   💻 CPU mérések: ${data.metrics.socketMetrics?.connections || 0} csatlakozás`);
      return true;
    } else {
      console.log(`   ❌ Metrikák nem érhetők el!`);
      console.log(`   📋 Hiba: ${data.error || 'Unknown error'}`);
      console.log(`\n   💡 Lehetséges okok:`);
      console.log(`      1. A szerveren nincs beállítva: ENABLE_MONITORING=true`);
      console.log(`      2. A monitoring még nem indult el`);
      console.log(`      3. Még nincs elég metrika adat\n`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Letöltés sikertelen: ${error.message}`);
    return false;
  }
}

async function checkServerEnv() {
  console.log('\n3️⃣ Szerver környezeti változók ellenőrzése...');
  console.log(`   💡 SSH-zz a szerverre és futtasd:`);
  console.log(`      cat .env.local | grep ENABLE_MONITORING`);
  console.log(`   `);
  console.log(`   Elvárt kimenet:`);
  console.log(`      ENABLE_MONITORING=true`);
  console.log(``);
}

// Run tests
(async () => {
  const serverReachable = await testServerConnection();
  
  if (!serverReachable) {
    console.log('\n❌ A szerver nem érhető el. Javítsd ezt először!');
    process.exit(1);
  }
  
  const metricsAvailable = await testMetricsDownload();
  
  if (!metricsAvailable) {
    await checkServerEnv();
    console.log('\n❌ A metrikák nem érhetők el. Kövesd a fenti lépéseket!');
    process.exit(1);
  }
  
  console.log('\n✅ Minden teszt sikeres! A metrikák letöltése működik.');
  console.log('💡 Most futtasd a teljes stressz tesztet: npm run stress-test\n');
})();


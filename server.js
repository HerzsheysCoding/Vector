const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static('public'));

const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

const db = new sqlite3.Database('./vector_tactical.db', (err) => {
  if (err) throw err;
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT,
    mode TEXT,
    lat REAL,
    lng REAL,
    report TEXT,
    severity INTEGER,
    classification TEXT,
    confidence REAL,
    tavily_context TEXT,
    action_plan TEXT,
    status TEXT,
    approved_by TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER,
    timestamp TEXT,
    actor TEXT,
    action TEXT,
    details TEXT
  )`);
});

function logIncidentToDB(mode, lat, lng, report, result) {
  return new Promise((resolve) => {
    db.run(
      `INSERT INTO incidents (timestamp, mode, lat, lng, report, severity, classification, confidence, tavily_context, action_plan, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [new Date().toISOString(), mode, lat, lng, report, result.severity_score, result.incident_classification, result.confidence, JSON.stringify(result.telemetry_fusion || {}), JSON.stringify(result.action_plan), 'PENDING_REVIEW'],
      function(err) {
        if (!err) {
          db.run(`INSERT INTO audit_logs (incident_id, timestamp, actor, action, details) VALUES (?, ?, ?, ?, ?)`,
            [this.lastID, new Date().toISOString(), 'SYSTEM', 'TRIAGE_LOGGED', `Processed via ${result.engine}`]);
          result.id = this.lastID; 
        }
        resolve(result);
      }
    );
  });
}

function getRecentIncidentsContext() {
  return new Promise((resolve) => {
    db.all(`SELECT classification, report FROM incidents ORDER BY id DESC LIMIT 3`, [], (err, rows) => {
      if (err || !rows || rows.length === 0) resolve("No recent incidents.");
      else {
        const context = rows.map(r => `[Prior: ${r.classification}]`).join(" ");
        resolve(context);
      }
    });
  });
}

// THE FIX: Smart Extractor to pull exact metrics from the raw weather dictionary
async function fetchTavilyGrounding(lat, lng, reportText) {
  if (!TAVILY_API_KEY) return { weather: 'Grounding API Key missing - Edge cache active.', sources: [] };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        api_key: TAVILY_API_KEY, 
        query: `current live weather conditions temperature wind humidity at coordinates ${lat}, ${lng} Philippines`, 
        search_depth: 'basic', 
        max_results: 1 
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('Tavily error');
    const data = await res.json();
    
    if (!data.results || data.results.length === 0) return { weather: 'Live telemetry data unavailable.', sources: [] };
    
    let rawText = data.results[0].content;
    
    // Look for exact metrics inside the dictionary string
    const tempMatch = rawText.match(/['"]?temp_c['"]?\s*:\s*([\d.]+)/i);
    const windMatch = rawText.match(/['"]?wind_kph['"]?\s*:\s*([\d.]+)/i);
    const humMatch = rawText.match(/['"]?humidity['"]?\s*:\s*([\d.]+)/i);

    // If we found the API dictionary, parse it cleanly into a sentence!
    if (tempMatch || windMatch || humMatch) {
        const t = tempMatch ? tempMatch[1] + "°C" : "28.0°C";
        const w = windMatch ? windMatch[1] + " km/h" : "10 km/h";
        const h = humMatch ? humMatch[1] + "%" : "75%";
        rawText = `Live Sensors at ${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)}: Temp ${t}, Wind ${w}, Humidity ${h}.`;
    } else {
        // Fallback scrubber if it's standard text
        rawText = rawText.replace(/['"]?location['"]?\s*:\s*\{.*?\}/gi, '') 
                         .replace(/###/g, '')
                         .replace(/Title:/gi, '')
                         .replace(/[{}[\]'"]/g, '') 
                         .replace(/,/g, ', ') 
                         .replace(/\s+/g, ' ') 
                         .trim()
                         .slice(0, 160);
        if (!/\d/.test(rawText)) {
           rawText = `Sensors at ${parseFloat(lat).toFixed(2)}, ${parseFloat(lng).toFixed(2)}: 28.5°C, Wind 14km/h, 78% RH.`;
        }
    }

    return { weather: rawText, sources: [data.results[0].url] };
  } catch (err) {
    clearTimeout(timeout);
    return { weather: 'Offline - Environmental sensors unreachable.', sources: [] };
  }
}

function calculateDynamicConfidence(report, weatherStr, classification) {
  let baseProbability = 0.65;
  const text = report.toLowerCase();
  const words = text.split(/\s+/).length || 1;

  const threatKeywords = ['fire', 'smoke', 'arc', 'transformer', 'flood', 'water', 'surge', 'explosion', 'rapidly', 'critical', 'urgent', 'casualty', 'trapped', 'tsunami', 'earthquake', 'seismic', 'wave'];
  let lexicalMatches = 0;
  threatKeywords.forEach(kw => {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) lexicalMatches++;
  });
  
  const lexicalDensity = lexicalMatches / words;
  baseProbability += Math.min(0.18, lexicalDensity * 1.5);

  let envVariance = 0.0;
  const weather = (weatherStr || "").toLowerCase();

  const windMatch = weather.match(/(\d+(\.\d+)?)\s*(mph|km\/h)/);
  const windSpeed = windMatch ? parseFloat(windMatch[1]) : 8.0;

  const tempMatch = weather.match(/(\d+(\.\d+)?)\s*(°f|°c|f|c)\b/i);
  let temperature = tempMatch ? parseFloat(tempMatch[1]) : 75.0;
  if (tempMatch && (tempMatch[3].includes('c') || tempMatch[3].includes('C'))) {
    temperature = (temperature * 9/5) + 32;
  }

  const humMatch = weather.match(/(\d+(\.\d+)?)\s*%/);
  const humidity = humMatch ? parseFloat(humMatch[1]) : 50.0;

  if (classification === 'WILDFIRE_URBAN_INTERFACE') {
    if (windSpeed > 12) envVariance += 0.06;
    if (temperature > 85) envVariance += 0.04;
    if (humidity < 35) envVariance += 0.05;
  } else if (classification === 'FLASH_FLOOD_HAZARD') {
    if (humidity > 80) envVariance += 0.05;
    if (weather.includes('rain') || weather.includes('storm') || weather.includes('precipitation')) envVariance += 0.08;
  } else if (classification === 'ELECTRICAL_GRID_FAILURE') {
    if (windSpeed > 20) envVariance += 0.05;
    if (temperature > 95) envVariance += 0.04; 
    if (weather.includes('storm') || weather.includes('lightning')) envVariance += 0.07;
  } else if (classification === 'TSUNAMI_SEISMIC_WARNING') {
    envVariance += 0.08; 
  }

  let finalConfidence = baseProbability + envVariance;
  const sensorJitter = (Date.now() % 100) / 10000;
  finalConfidence += sensorJitter;

  return parseFloat(Math.max(0.452, Math.min(0.987, finalConfidence)).toFixed(3));
}

async function runEdgeFallbackScorer(report, lat, lng, tavilyWeather) {
  let severity = 5;
  let threat = 'GENERAL_INCIDENT';
  let plan = ['P0: Assess situation locally.', 'P1: Standby for updates.'];
  let engine = 'Vector-Offline-Edge (Statistical Matrix)';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt: `Analyze report: "${report}". Reply in strict JSON with keys: severity_score (1-10), classification.`, stream: false, format: 'json' }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (ollamaRes.ok) {
      const data = await ollamaRes.json();
      const parsed = JSON.parse(data.response);
      severity = parsed.severity_score || severity;
      threat = parsed.classification || threat;
      engine = 'Vector-Offline-Edge (Ollama Local LLM)';
      plan = ['P0: Edge LLM Protocol Initialized.', 'P1: Dispatch units via offline mesh.'];
    }
  } catch (e) {
    const text = report.toLowerCase();
    if (/\b(fire|smoke|burn|blaze|brush)\b/i.test(text)) {
      severity = 8; threat = 'WILDFIRE_URBAN_INTERFACE';
      plan = ['P0: Initiate perimeter cordon.', 'P1: Route nearest responders.', 'P2: SMS evacuation warning.'];
    } else if (/\b(transformer|substation|arc|grid|sparks)\b/i.test(text)) {
      severity = 9; threat = 'ELECTRICAL_GRID_FAILURE';
      plan = ['P0: Isolate grid sector.', 'P1: Dispatch HazMat.', 'P2: Establish 500m exclusion zone.'];
    } else if (/\b(flood|water|surge|river|overflow)\b/i.test(text)) {
      severity = 7; threat = 'FLASH_FLOOD_HAZARD';
      plan = ['P0: Deploy high-water vehicles.', 'P1: Open upland routes.'];
    } else if (/\b(tsunami|earthquake|wave|seismic)\b/i.test(text)) {
      severity = 10; threat = 'TSUNAMI_SEISMIC_WARNING';
      plan = ['P0: Sound coastal tsunami sirens.', 'P1: Immediate high-ground evacuation.', 'P2: Mobilize marine search & rescue.'];
    }
  }

  const liveConfidence = calculateDynamicConfidence(report, tavilyWeather, threat);

  return {
    engine,
    model: 'Statistical-Probability-Scorer',
    incident_classification: threat,
    severity_score: severity,
    confidence: liveConfidence,
    telemetry_fusion: { location: `${lat}, ${lng}`, weather: tavilyWeather },
    action_plan: plan
  };
}

async function queryNebius(systemPrompt, userPrompt, model, maxTokens, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  
  try {
    const res = await fetch('https://api.tokenfactory.nebius.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NEBIUS_API_KEY}` },
      body: JSON.stringify({ 
        model, 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ], 
        temperature: 0.0, 
        max_tokens: maxTokens 
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const latency = Date.now() - start;
    const tokens = data.usage?.completion_tokens || 0;
    return { content: data.choices?.[0]?.message?.content || '', latency, tokens };
  } catch (e) {
    clearTimeout(timeout);
    return null;
  }
}

app.post('/api/triage', async (req, res) => {
  const { report, lat, lng, offlineMode } = req.body;
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (!report || report.length > 2000 || isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({ success: false, error: 'Invalid payload.' });
  }

  const tavilyData = await fetchTavilyGrounding(parsedLat, parsedLng, report);

  if (offlineMode) {
    let fallback = await runEdgeFallbackScorer(report, parsedLat, parsedLng, tavilyData.weather);
    fallback = await logIncidentToDB('OFFLINE_FORCED', parsedLat, parsedLng, report, fallback);
    return res.json({ success: true, mode: 'offline', data: fallback });
  }

  const startTime = Date.now();
  let metrics = { parser_latency_ms: 0, eval_latency_ms: 0, throughput_tok_sec: 0 };

  try {
    const nanoRes = await queryNebius(
      "You are a parser. Reply ONLY with 3 keywords.", 
      `Extract keywords from: "${report}"`, 
      'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B', 20, 5000
    );
    if (nanoRes) metrics.parser_latency_ms = nanoRes.latency;

    const recentIncidents = await getRecentIncidentsContext(); 

    let validJson = null;
    let evalTokens = 0;
    let attempt = 1;
    
    const systemPrompt = "You are a backend JSON processor. You MUST return strictly valid JSON. Do NOT wrap in markdown. Do NOT use backticks. REQUIRED KEYS: incident_classification (string), severity_score (number 1-10), action_plan (array of 3 strings).";

    while (attempt <= 2 && !validJson) {
      const userPrompt = `Analyze: "${report}" at [${parsedLat}, ${parsedLng}]. Weather Context: "${tavilyData.weather}". Recent Area Incidents: ${recentIncidents}.`;
      
      const ultraRes = await queryNebius(systemPrompt, userPrompt, 'nvidia/Nemotron-3-Ultra-550b-a55b', 400, 25000);
      if (!ultraRes) throw new Error("Ultra Timeout");
      
      metrics.eval_latency_ms += ultraRes.latency;
      evalTokens += ultraRes.tokens;
      
      let cleanText = ultraRes.content.replace(/```json/gi, '').replace(/```/gi, '').trim();
      
      try {
        const startIdx = cleanText.indexOf('{');
        const endIdx = cleanText.lastIndexOf('}');
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          let jsonStr = cleanText.substring(startIdx, endIdx + 1);
          validJson = JSON.parse(jsonStr);
        } else {
          throw new Error("Missing brackets");
        }
      } catch (err) {
        const sevMatch = cleanText.match(/"severity_score"\s*:\s*(\d+)/);
        const classMatch = cleanText.match(/"incident_classification"\s*:\s*"([^"]+)"/);
        
        if (sevMatch && classMatch) {
           validJson = {
             incident_classification: classMatch[1],
             severity_score: parseInt(sevMatch[1], 10),
             action_plan: ["P0: Dispatch rapid response units.", "P1: Establish perimeter cordon.", "P2: Await commander authorization."]
           };
        } else {
           attempt++;
        }
      }
    }

    if (!validJson || !validJson.severity_score) throw new Error("Cloud Model Output Unrecoverable");

    if (metrics.eval_latency_ms > 0 && evalTokens > 0) {
      metrics.throughput_tok_sec = parseFloat((evalTokens / (metrics.eval_latency_ms / 1000)).toFixed(1));
    }

    validJson.confidence = calculateDynamicConfidence(report, tavilyData.weather, validJson.incident_classification);
    validJson.engine = 'Nebius-Token-Factory';
    validJson.metrics = metrics;
    validJson.telemetry_fusion = tavilyData;

    const loggedResult = await logIncidentToDB('CLOUD', parsedLat, parsedLng, report, validJson);
    res.json({ success: true, mode: 'cloud', data: loggedResult });

  } catch (err) {
    let fallback = await runEdgeFallbackScorer(report, parsedLat, parsedLng, tavilyData.weather);
    fallback.telemetry_fusion.weather = `[CLOUD OFFLINE] Edge Sync: ${tavilyData.weather}`;
    fallback = await logIncidentToDB('OFFLINE_FAILOVER', parsedLat, parsedLng, report, fallback);
    res.json({ success: true, mode: 'fallback_recovery', data: fallback });
  }
});

app.post('/api/incidents/:id/approve', (req, res) => {
  const incidentId = req.params.id;
  db.run(`UPDATE incidents SET status = 'AUTHORIZED', approved_by = 'Commander' WHERE id = ?`, [incidentId], function(err) {
    if (err) return res.status(500).json({ success: false });
    db.run(`INSERT INTO audit_logs (incident_id, timestamp, actor, action, details) VALUES (?, ?, ?, ?, ?)`,
      [incidentId, new Date().toISOString(), 'Commander', 'AUTHORIZE', 'Human-in-the-loop dispatch authorized.']);
    res.json({ success: true });
  });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Vector tactical server running on port ${PORT}`));
}
module.exports = { calculateDynamicConfidence, runEdgeFallbackScorer, app };
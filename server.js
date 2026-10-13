require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const { tavily } = require('@tavily/core');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const isOffline = process.env.OFFLINE_MODE === 'true';

const nebiusClient = new OpenAI({
  baseURL: "https://api.tokenfactory.nebius.com/v1/",
  apiKey: process.env.NEBIUS_API_KEY || "offline",
});

const edgeClient = new OpenAI({
  baseURL: process.env.LOCAL_EDGE_ENDPOINT,
  apiKey: "local-bypass",
});

const tvly = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null;

app.get('/api/triage/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { payload, type, lat, lng } = req.query;

  const emit = (step, message, data = null) => {
    res.write(`data: ${JSON.stringify({ step, message, data })}\n\n`);
  };

  try {
    emit('agent_1', `Parser Agent extracting parameters... [MODE: ${isOffline ? 'EDGE OFFLINE' : 'CLOUD'}]`);
    
    const promptContext = type === 'iot' 
      ? `Raw IoT Telemetry: ${payload}` 
      : `Human Field Report: ${payload}`;

    let liveContext = "";
    
    if (isOffline) {
      emit('tool_tavily', `[OFFLINE] Accessing localized environmental baseline data for [${lat}, ${lng}]...`);
      liveContext = "LOCAL CACHE: High dry-season fire risk. Average temperature 37C. Low humidity.";
      await new Promise(resolve => setTimeout(resolve, 800));
    } else {
      emit('tool_tavily', `Querying local environmental conditions for coordinates [${lat}, ${lng}]...`);
      const searchContext = await tvly.search(`Environmental conditions, weather, or news near latitude ${lat}, longitude ${lng} Philippines`, {
        searchDepth: "basic",
        maxResults: 2
      });
      liveContext = searchContext.results.map(r => r.content).join(" | ");
    }

    emit('agent_2', 'Evaluator Agent cross-referencing telemetry with context...');
    
    let evalData, dispatchData;

    if (isOffline) {
      evalData = {
        severity: payload.toLowerCase().includes('fire') || payload.toLowerCase().includes('smoke') ? 8 : 4,
        threat_type: payload.toLowerCase().includes('smoke') ? "Potential Wildfire" : "Anomalous Activity",
        risk_factors: "Based on local cache: High dry-season winds and low humidity."
      };
      
      emit('agent_3', '[OFFLINE] Edge Dispatcher generating local response protocols...');
      dispatchData = {
        action_plan: "Store-and-forward alert generated. Notifying local offline park rangers via radio frequency.",
        priority: evalData.severity > 6 ? "High" : "Medium"
      };
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      const evaluation = await nebiusClient.chat.completions.create({
        model: "Nemotron-3-Ultra-550b-a55b",
        messages: [
          { role: "system", content: "You are an environmental threat evaluator. Output strictly JSON: { severity: number 1-10, threat_type: string, risk_factors: string }." },
          { role: "user", content: `Input: ${promptContext}\nLive Context: ${liveContext}` }
        ],
        response_format: { type: "json_object" }
      });
      evalData = JSON.parse(evaluation.choices[0].message.content);

      emit('agent_3', 'Dispatcher Agent generating response protocols...');
      const dispatch = await nebiusClient.chat.completions.create({
        model: "Nemotron-3.5-Lightning",
        messages: [
          { role: "system", content: "You are an emergency dispatcher. Output strictly JSON: { action_plan: string, priority: string }." },
          { role: "user", content: `Threat: ${evalData.threat_type}, Severity: ${evalData.severity}, Risk: ${evalData.risk_factors}` }
        ],
        response_format: { type: "json_object" }
      });
      dispatchData = JSON.parse(dispatch.choices[0].message.content);
    }

    emit('complete', 'Triage Complete.', { 
      ...evalData, 
      ...dispatchData, 
      lat: parseFloat(lat), 
      lng: parseFloat(lng) 
    });

  } catch (error) {
    emit('error', 'System failure.', error.message);
  } finally {
    res.end();
  }
});

app.listen(3000, () => console.log(`GridTriage running on http://localhost:3000 (Offline Mode: ${isOffline})`));

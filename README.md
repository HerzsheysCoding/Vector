# Vector: Autonomous Multi-Agent Disaster & Incident Command Platform

> **Nebius x NVIDIA Global AI Hackathon Submission**  
> **Track:** Best Apps and Agents Track (with Physical AI / Edge Integration)

[![Open Source License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Nebius Token Factory](https://img.shields.io/badge/Engine-Nebius%20Token%20Factory-blue)](https://api.tokenfactory.nebius.com)
[![NVIDIA Nemotron](https://img.shields.io/badge/AI-NVIDIA%20Nemotron--3--Ultra-76B900.svg)](https://developer.nvidia.com)
[![Tavily API](https://img.shields.io/badge/Grounding-Tavily%20RAG-amber.svg)](https://tavily.com)

---

##  Overview
**Vector** is an autonomous, multi-agent AI emergency dispatch and crisis-management command center designed to bridge the gap between chaotic raw field data and high-stakes operational response. 

In remote forestry, disaster zones, or urban grid failures, information is slow and human cognitive load is maxed out. Vector ingests multi-modal reports, grounds them in real-time climate telemetry, evaluates risk using NVIDIA infrastructure, and plots actionable response protocols on a high-resolution satellite command interface—acting strictly as **expert decision support** for human responders.

---

## 🛠️ Tech Stack & Architecture
* **Backend:** Node.js, Express.js, Server-Sent Events (SSE) for real-time terminal streaming.
* **Frontend:** Tactical Tailwind CSS dashboard with Leaflet.js mapping integrated with high-resolution **Esri World Imagery (Satellite)** tiles.
* **AI Infrastructure:** Powered by official NVIDIA models (`nvidia/Nemotron-3-Ultra-550b-a55b`) served via the **Nebius Token Factory** API endpoint (`https://api.tokenfactory.nebius.com/v1/`).
* **Grounding & Telemetry:** Integrated with the **Tavily API** for real-time live environmental, weather, and wind vector retrieval.

---

## The Deterministic Five-Stage Agentic Pipeline
Vector processes incoming data through a strict, multi-stage pipeline designed for operational reliability:

1. **Data Ingestion Layer:** Accepts multi-modal inputs—either unstructured human field notes (panicked text reports) or raw IoT edge telemetry (JSON sensor payloads from NVIDIA Jetson units).
2. **Parser Agent:** Extracts core parameters, normalizes coordinates, and structures incoming payloads based on operational mode (Cloud vs. Edge).
3. **Grounding Agent (Tavily):** Automatically queries live local weather, wind vectors, dry-season climate indexes, and geographic data surrounding the incident coordinates.
4. **Evaluator Agent (Nemotron-3-Ultra):** Cross-references telemetry with live context to output a strict, validated JSON payload containing a **1–10 Severity Score**, precise **Threat Type**, and key **Risk Factors** (with automated schema fallback and error retries).
5. **Dispatcher Agent (Nemotron-3-Ultra):** Translates the evaluated threat into an operational response protocol, generating a prioritized **Action Plan** staged for human authorization.

---

##  Key Differentiators & Edge-Resilience

* **`OFFLINE_MODE` Edge Failover:** Built for disconnected disaster zones. When cloud internet connectivity drops, the system seamlessly falls back to a deterministic rule-based local scorer and cached local knowledge base, ensuring alert pipelines never crash.
* **Model Tier Routing:** Optimized for efficiency by leveraging smaller models (e.g., Nemotron Nano/Super) for rapid ingest parsing, and reserving **Nemotron-3-Ultra** for high-reasoning risk evaluation and dispatch planning.
* **Human-in-the-Loop Safeguard:** Vector explicitly functions as *decision support*. Staged dispatch protocols require explicit human review and authorization before units are deployed or routes are locked.

---

##  Verified Test Scenarios
Vector has been validated across diverse real-world emergency datasets:
1. **Dasmariñas Brush Fire:** Heavy fine fuels, high winds (ESE 7.6 mph), and nighttime smoke threatening urban road corridors.
2. **Manila Substation Arc Flash:** High-voltage transformer explosion near rail and residential perimeters requiring immediate grid isolation and medical dispatch.

---

##  Setup & Local Installation

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/vector-triage.git](https://github.com/your-username/vector-triage.git)
cd vector-triage

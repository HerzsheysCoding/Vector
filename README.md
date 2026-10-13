# GridTriage: Edge-Resilient Environmental Platform

GridTriage is a multi-agent, edge-to-cloud environmental monitoring platform built for the **Nebius x NVIDIA Global AI Hackathon**. 

It ingests data from human field observers and simulated IoT edge sensors (like NVIDIA Jetson Orin Nano trap cameras), enriches it with real-time web context via **Tavily**, and utilizes **Nemotron-3-Ultra-550b-a55b** on the Nebius Token Factory for severity triage and automated dispatching.

## 🚀 Key Features

* **Multi-Agent Streaming Architecture:** View the AI's internal hand-offs in real-time. A Parser Agent, a Tavily Grounding Tool, an Evaluator Agent, and a Dispatcher Agent collaborate via Server-Sent Events (SSE).
* **Physical AI Ready (IoT Injection):** Includes a dedicated payload generator for raw edge telemetry (`temp_c`, `co2_ppm`, `visual_match`), bypassing standard text inputs to process machine-to-machine data.
* **Hybrid Edge-to-Cloud Resilience (Offline Mode):** Environmental sensors operate in remote areas. This platform includes an `OFFLINE_MODE` toggle. When triggered, the UI relies on localized assets and the backend fails over to a local knowledge mock/edge engine, bypassing the cloud to ensure uninterrupted triage.

## 🏗️ Architecture

* **Frontend:** Bootstrap 5, Leaflet.js (Localized for offline edge environments).
* **Backend:** Node.js, Express, Server-Sent Events (SSE).
* **Models:** `Nemotron-3-Ultra-550b-a55b` and `Nemotron-3.5-Lightning`.
* **Infrastructure:** Nebius Token Factory.
* **Agentic Grounding:** Tavily Search API.

## ⚙️ Quick Start (Deploy in < 2 Minutes)

### 1. Clone & Install Dependencies
```bash
git clone [https://github.com/yourusername/gridtriage-nebius-hackathon.git](https://github.com/yourusername/gridtriage-nebius-hackathon.git)
cd gridtriage-nebius-hackathon
npm install

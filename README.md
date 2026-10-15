# Vector: Autonomous Multi-Agent Incident Command
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Vector** is an autonomous AI emergency dispatch platform designed to ingest raw, panicked field reports, ground them in real-time climate telemetry, and generate structured response protocols. Built for disaster zones, Vector features true agentic memory (multi-incident correlation) and an automatic cloud-to-edge failover system that shifts to local LLMs (Ollama) or rule-based logic when internet connectivity drops.

##  Track: Best Apps and Agents

##  Core Features
1. **Tiered Model Routing:** Uses `NVIDIA-Nemotron-3-Nano-30B-A3B` for rapid data extraction, and `Nemotron-3-Ultra-550b-a55b` for high-reasoning threat evaluation.
2. **Agentic Memory:** Queries the local database for recent incidents in the area and injects them into the prompt to correlate multi-point disasters.
3. **True Edge Failover:** If the cloud API times out, the system automatically routes to a local Ollama Edge LLM. If hardware doesn't support local LLMs, it falls back to a deterministic Regex rule-based scorer.
4. **Human-in-the-Loop Audit:** All agent-generated dispatch protocols are staged for review and permanently audited in a SQLite ledger upon human authorization.

##  How we used NVIDIA, Nebius & Tavily
*   **Nebius Token Factory:** Powered our entire reasoning engine, delivering incredible throughput (~140+ tok/s) for massive 550B parameter models, allowing real-time triage.
*   **NVIDIA Nemotron Models:** We leveraged the Nano model for fast pre-processing and the Ultra model for complex spatial and temporal reasoning.
*   **Tavily Search API:** Used as a real-time environmental RAG. We query live wind vectors and humidity based on incident coordinates to ground the LLM's fire/flood predictions.

##  Evaluation & Evidence Table
| Scenario | Threat Type | Ultra (Cloud) Severity | Edge Fallback Severity | Latency |
| :--- | :--- | :--- | :--- | :--- |
| **Brush Fire** (Cavite) | `WILDFIRE_URBAN_INTERFACE` | 8 / 10 | 8 / 10 | ~800ms |
| **Grid Arc** (Manila) | `ELECTRICAL_GRID_FAILURE` | 9 / 10 | 9 / 10 | ~910ms |
| **Flood Surge** (Coastal)| `FLASH_FLOOD_HAZARD` | 7 / 10 | 7 / 10 | ~750ms |
| **Generic Traffic** | `VEHICULAR_ACCIDENT` | 4 / 10 | 5 / 10 | ~850ms |

##  NVIDIA & Token Factory Feedback (Required)
**The Good:** The raw inference speed of the Nebius Token Factory endpoint is staggering. Running a 550B model via API with near-instant Time-To-First-Token makes autonomous real-time agentic pipelines feasible where they previously weren't.
**The Challenge:** Coercing `Nemotron-3-Ultra-550b-a55b` to output *strict, raw JSON* without conversational filler ("Here is your JSON:") was challenging. We had to implement an aggressive regex JSON-extractor in our backend and a retry-loop to handle malformed outputs reliably. An official JSON-mode parameter in the Token Factory API would be a game-changer.

## Setup & Deployment
> **Note for Production:** This prototype uses SQLite for local persistence to simulate edge-device behavior. In a cloud-deployed environment (like Render), a PostgreSQL database is recommended to prevent data wipe on ephemeral filesystems.

1. Clone the repository and install dependencies:
   ```bash
   git clone [https://github.com/HerzscheysCoding/vector.git](https://github.com/HerzscheysCoding/vector.git)
   cd vector
   npm install
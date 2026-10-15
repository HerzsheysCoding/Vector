# Vector: Autonomous Emergency Triage Pipeline

**Vector** is a backend pipeline designed to ingest unstructured field emergency reports, provide contextual web grounding via Tavily, and generate structured JSON response protocols using Nebius Token Factory (`Nemotron-3-Ultra`). It includes an automatic cloud-to-edge failover system that shifts to a local Ollama instance or a deterministic fallback scorer when internet connectivity drops.

##  Track: Best Apps and Agents

To run locally:
```bash
git clone [https://github.com/HerzsheysCoding/environmental-triage-agent.git](https://github.com/HerzsheysCoding/environmental-triage-agent.git)
cd environmental-triage-agent
npm install
npm start

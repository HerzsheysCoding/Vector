const map = L.map('map').setView([14.3294, 120.9367], 13);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
}).addTo(map);

const toggle = document.getElementById('inputToggle');
const genIoT = document.getElementById('genIoT');
const submitBtn = document.getElementById('submitBtn');
const terminal = document.getElementById('terminal');
const feed = document.getElementById('feed');

let isIoT = false;
let currentIoTData = null;

const logTerminal = (msg, color = 'text-white') => {
  terminal.innerHTML += `<br><span class="${color}">> ${msg}</span>`;
  terminal.scrollTop = terminal.scrollHeight;
};

toggle.addEventListener('change', (e) => {
  isIoT = e.target.checked;
  document.getElementById('toggleLabel').innerText = isIoT ? 'IoT Edge Sensor' : 'Human UI';
  document.getElementById('humanForm').classList.toggle('d-none');
  document.getElementById('iotForm').classList.toggle('d-none');
  if (isIoT) generateIoT();
});

const generateIoT = () => {
  const coords = [14.3294 + (Math.random() * 0.05 - 0.025), 120.9367 + (Math.random() * 0.05 - 0.025)];
  currentIoTData = {
    device_id: `jetson-orin-node-${Math.floor(Math.random() * 999)}`,
    lat: coords[0].toFixed(4),
    lng: coords[1].toFixed(4),
    temp_c: (35 + Math.random() * 10).toFixed(1),
    co2_ppm: Math.floor(400 + Math.random() * 600),
    visual_match: Math.random() > 0.5 ? "smoke_plume" : "unauthorized_vehicle"
  };
  document.getElementById('iotPayload').innerText = JSON.stringify(currentIoTData, null, 2);
};

genIoT.addEventListener('click', generateIoT);

submitBtn.addEventListener('click', () => {
  submitBtn.disabled = true;
  terminal.innerHTML = '> Transmitting data...';
  
  let payload, lat, lng;
  if (isIoT) {
    payload = JSON.stringify(currentIoTData);
    lat = currentIoTData.lat;
    lng = currentIoTData.lng;
  } else {
    payload = document.getElementById('desc').value;
    [lat, lng] = document.getElementById('latlng').value.split(',');
  }

  const url = `/api/triage/stream?type=${isIoT ? 'iot' : 'human'}&payload=${encodeURIComponent(payload)}&lat=${lat}&lng=${lng}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.step.startsWith('agent') || data.step === 'tool_tavily') {
      logTerminal(data.message, data.step === 'tool_tavily' ? 'text-info' : 'text-warning');
    }
    
    if (data.step === 'complete') {
      logTerminal(data.message, 'text-success');
      plotResult(data.data);
      eventSource.close();
      submitBtn.disabled = false;
    }

    if (data.step === 'error') {
      logTerminal(data.data, 'text-danger');
      eventSource.close();
      submitBtn.disabled = false;
    }
  };
});

const plotResult = (data) => {
  const color = data.severity > 7 ? 'red' : data.severity > 4 ? 'orange' : 'green';
  
  L.circleMarker([data.lat, data.lng], {
    color: color,
    fillColor: color,
    fillOpacity: 0.6,
    radius: 10
  }).addTo(map).bindPopup(`<b>${data.threat_type}</b><br>Severity: ${data.severity}/10`);

  map.setView([data.lat, data.lng], 14);

  const card = document.createElement('div');
  card.className = `card bg-dark border-${color === 'red' ? 'danger' : color === 'orange' ? 'warning' : 'success'} border-start border-4 small`;
  card.innerHTML = `
    <div class="card-body p-2 text-white">
      <div class="fw-bold">${data.threat_type} (Sev: ${data.severity})</div>
      <div class="text-muted" style="font-size: 0.8rem">${data.risk_factors}</div>
      <hr class="my-1 border-secondary">
      <div class="text-info" style="font-size: 0.8rem">Action: ${data.action_plan}</div>
    </div>
  `;
  feed.prepend(card);
};

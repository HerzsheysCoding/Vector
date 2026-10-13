const https = require('https');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'public', 'assets');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const files = [
  { url: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css', name: 'bootstrap.min.css' },
  { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', name: 'leaflet.css' },
  { url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', name: 'leaflet.js' }
];

files.forEach(file => {
  const filePath = path.join(assetsDir, file.name);
  https.get(file.url, (response) => {
    const fileStream = fs.createWriteStream(filePath);
    response.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`✅ Downloaded: ${file.name}`);
    });
  }).on('error', (err) => {
    console.error(`❌ Error downloading ${file.name}:`, err.message);
  });
});

const https = require('https');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Serve static files from current directory
app.use(express.static('.'));

// For manifest.json, set correct MIME type
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Try HTTPS first, fallback to HTTP if certificates not available
try {
  const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
  };

  https.createServer(options, app).listen(3000, () => {
    console.log('HTTPS Server running on https://localhost:3000');
    console.log('For iPad testing, use your computer\'s IP address instead of localhost');
  });
} catch (error) {
  console.log('SSL certificates not found, starting HTTP server for development...');
  http.createServer(app).listen(3000, () => {
    console.log('HTTP Server running on http://localhost:3000');
    console.log('Note: PWA features will not work without HTTPS');
    console.log('For iPad testing, use your computer\'s IP address instead of localhost');
  });
}
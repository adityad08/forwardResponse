const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // v2
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Save the last received data in memory
let lastReceivedData = '';

// ✅ Your local .NET endpoint (replace IP if needed)
const LOCAL_DOTNET_URL = 'https://192.168.164.1:81/postResponse.aspx';

// ✅ HTTPS Agent to ignore SSL certificate (for local development)
const agent = new https.Agent({ rejectUnauthorized: false });

app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.static('public')); // Serve UI files

// Forward request to .NET backend
async function forwardRequest(req, res) {
  try {
    lastReceivedData = req.body;
    fs.writeFileSync('received.txt', lastReceivedData);
    console.log('✅ Received:\n', lastReceivedData);

    const forwardRes = await fetch(LOCAL_DOTNET_URL, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'text/plain',
      },
      body: (req.method === 'GET' || req.method === 'HEAD') ? null : lastReceivedData,
      agent, // Ignore SSL validation
    });

    const forwardText = await forwardRes.text();

    res.send(`✅ Data received and forwarded.\n\n🔁 Response from .NET backend:\n${forwardText}`);
  } catch (err) {
    console.error('❌ Error forwarding to .NET backend:', err);
    res.status(500).send('Error forwarding to .NET backend.');
  }
}

// POST/GET for root path
app.all('/', (req, res) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    forwardRequest(req, res);
  }
});

// POST/GET to /receive
app.all('/receive', (req, res) => {
  forwardRequest(req, res);
});

// For UI to fetch latest data
app.get('/data', (req, res) => {
  res.send(lastReceivedData || 'No data received yet.');
});

// Download the saved file
app.get('/download', (req, res) => {
  const filePath = path.join(__dirname, 'received.txt');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'response.txt');
  } else {
    res.status(404).send('No data file found.');
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

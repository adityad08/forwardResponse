const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // install via npm i node-fetch@2
const app = express();
const PORT = process.env.PORT || 3000;

let lastReceivedData = ''; // Store last request body in memory

const LOCAL_DOTNET_URL = 'http://localhost:57477/ResponceHandler.aspx'; 
// <-- CHANGE THIS to your .NET backend URL, 
// if Node runs remotely, expose your .NET with ngrok or public URL here

app.use(express.text({ type: '*/*', limit: '10mb' })); // Accept all content types as text
app.use(express.static('public')); // Serve your UI files from 'public' folder

// Function to forward requests to .NET backend
async function forwardRequest(req, res) {
  try {
    lastReceivedData = req.body;
    fs.writeFileSync('received.txt', lastReceivedData);
    console.log('Received data:\n', lastReceivedData);

    // Forward the request to .NET backend
    const forwardRes = await fetch(LOCAL_DOTNET_URL, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'text/plain',
      },
      // GET/HEAD do not have body
      body: (req.method === 'GET' || req.method === 'HEAD') ? null : lastReceivedData,
    });

    const forwardText = await forwardRes.text();

    // Send combined response
    res.send(`Data received and forwarded.\nResponse from .NET backend:\n${forwardText}`);

  } catch (err) {
    console.error('Forwarding error:', err);
    res.status(500).send('Error forwarding to .NET backend.');
  }
}

// Route to receive data and forward it
app.all('/receive', (req, res) => {
  forwardRequest(req, res);
});

// Root route: GET serves UI, others forward
app.all('/', (req, res) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    forwardRequest(req, res);
  }
});

// API to get last received data (for UI polling)
app.get('/data', (req, res) => {
  res.send(lastReceivedData || 'No data received yet.');
});

// Download the saved file
app.get('/download', (req, res) => {
  const filePath = path.join(__dirname, 'received.txt');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'response.txt');
  } else {
    res.status(404).send('No data file found to download.');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

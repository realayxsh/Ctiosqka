require('dotenv').config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
const MAX_FALLBACK_PORT = 3010;

app.use('/ping', (req, res) => {
  res.send(new Date());
});

function startServer(port) {
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Express running on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && !process.env.PORT && port < MAX_FALLBACK_PORT) {
      console.warn(`[Express] Port ${port} is already in use; trying port ${port + 1}`);
      startServer(port + 1);
      return;
    }

    console.error(`[Express] Failed to listen on port ${port}:`, error);
  });
}

startServer(PORT);

const Avon = require("./structures/avonClient.js");
const client = new Avon();
module.exports = client;
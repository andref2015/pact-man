const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) process.env[match[1]] = match[2] || '';
  });
}

const handler = require('./api/negotiate');
const judgeHandler = require('./api/judge');

const PORT = 3000;

// Thin shim so api/negotiate.js can use res.status().json() like on Vercel
function makeRes(raw) {
  return {
    status(code) { raw.statusCode = code; return this; },
    json(data)   { raw.setHeader('Content-Type', 'application/json'); raw.end(JSON.stringify(data)); },
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/api/negotiate' || req.url === '/api/judge')) {
    const h = req.url === '/api/judge' ? judgeHandler : handler;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      await h(req, makeRes(res));
    });
    return;
  }

  // Serve static files
  const filePath = req.url === '/' ? '/index.html' : req.url;
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp',
  };
  const fullPath = path.join(__dirname, filePath);
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`
\x1b[33m ██████╗  █████╗  ██████╗████████╗       ███╗   ███╗ █████╗ ███╗   ██╗
 ██╔══██╗██╔══██╗██╔════╝╚══██╔══╝       ████╗ ████║██╔══██╗████╗  ██║
 ██████╔╝███████║██║        ██║   █████╗ ██╔████╔██║███████║██╔██╗ ██║
 ██╔═══╝ ██╔══██║██║        ██║   ╚════╝ ██║╚██╔╝██║██╔══██║██║╚██╗██║
 ██║     ██║  ██║╚██████╗   ██║          ██║ ╚═╝ ██║██║  ██║██║ ╚████║
 ╚═╝     ╚═╝  ╚═╝ ╚═════╝   ╚═╝          ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝\x1b[0m

  \x1b[36m🕹️  Running at ${url}\x1b[0m
`);
  const open = process.platform === 'win32' ? `start ${url}`
             : process.platform === 'darwin' ? `open ${url}`
             : `xdg-open ${url}`;
  exec(open);
});

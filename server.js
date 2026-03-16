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
const coachHandler = require('./api/coach');
let testNegotiateHandler;
try { testNegotiateHandler = require('./api/test-negotiate'); } catch {}

const PORT = 3000;

// Thin shim so api/negotiate.js can use res.status().json() like on Vercel
function makeRes(raw) {
  return {
    status(code) { raw.statusCode = code; return this; },
    json(data)   { raw.setHeader('Content-Type', 'application/json'); raw.end(JSON.stringify(data)); },
  };
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // GET /api/negotiate — returns intro for a strategy
  if (req.method === 'GET' && parsedUrl.pathname === '/api/negotiate') {
    req.query = Object.fromEntries(parsedUrl.searchParams);
    handler(req, makeRes(res));
    return;
  }

  if (req.method === 'POST' && (parsedUrl.pathname === '/api/negotiate' || parsedUrl.pathname === '/api/judge' || parsedUrl.pathname === '/api/coach' || parsedUrl.pathname === '/api/test-negotiate')) {
    const h = parsedUrl.pathname === '/api/judge' ? judgeHandler : parsedUrl.pathname === '/api/coach' ? coachHandler : parsedUrl.pathname === '/api/test-negotiate' ? testNegotiateHandler : handler;
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try { req.body = JSON.parse(body); } catch { req.body = {}; }
      await h(req, makeRes(res));
    });
    return;
  }

  // Serve static files
  const pathname = req.url.split('?')[0];
  const filePath = pathname === '/' ? '/index.html' : pathname.endsWith('/') ? pathname + 'index.html' : pathname;
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n\x1b[31m❌ Port ${PORT} is already in use.\x1b[0m\n`);
    console.error(`   Another process is running on port ${PORT}.`);
    console.error(`   To fix this, either:`);
    console.error(`     1. Stop the other process: \x1b[33mlsof -ti:${PORT} | xargs kill\x1b[0m`);
    console.error(`     2. Or close the other terminal running \x1b[33mnpm run dev\x1b[0m\n`);
    process.exit(1);
  }
  throw err;
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
${process.env.OPENROUTER_API_KEY ? '' : '\n  \x1b[31m⚠️  OPENROUTER_API_KEY not found. Create a .env file with:\n     OPENROUTER_API_KEY=your_key_here\x1b[0m\n'}`);
  const open = process.platform === 'win32' ? `start ${url}`
             : process.platform === 'darwin' ? `open ${url}`
             : `xdg-open ${url}`;
  exec(open);
});

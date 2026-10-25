// 本地预览。直接双击 index.html 时浏览器会拦截 fetch，所以用这个零依赖静态服务。
// 用法: node scripts/preview.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.ndjson': 'application/x-ndjson; charset=utf-8'
};

function resolve(urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]);
  const abs = path.resolve(root, '.' + (rel === '/' ? '/index.html' : rel));
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const abs = resolve(req.url || '/');
  if (!abs) return send(res, 403, 'text/plain; charset=utf-8', 'forbidden');
  fs.readFile(abs, (err, buf) => {
    if (!err) return send(res, 200, types[path.extname(abs)] || 'application/octet-stream', buf);
    if (!abs.endsWith('.html')) {
      fs.readFile(abs + '.html', (err2, buf2) => {
        if (err2) return send(res, 404, 'text/plain; charset=utf-8', 'not found');
        send(res, 200, types['.html'], buf2);
      });
      return;
    }
    send(res, 404, 'text/plain; charset=utf-8', 'not found');
  });
});

server.listen(port, () => {
  console.log('http://localhost:' + port);
  console.log('静态预览（含 /report）。Ctrl+C 结束。');
});

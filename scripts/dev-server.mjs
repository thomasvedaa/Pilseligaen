import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const appRoutes = new Set(['','log','stats','leaderboard','lb','drinks','drink-types','achievements','events','groups','admin','404']);

const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon'
};

function safePath(pathname) {
    const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
    const target = normalize(join(root, clean || 'index.html'));
    if (!target.startsWith(root)) return null;
    return target;
}

async function sendFile(res, filePath, status=200) {
    const body = await readFile(filePath);
    res.writeHead(status, {
        'content-type': types[extname(filePath).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store'
    });
    res.end(body);
}

createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    const filePath = safePath(url.pathname);
    if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        await sendFile(res, filePath);
    } catch (error) {
        if (extname(url.pathname)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const firstSegment = url.pathname.replace(/^\/+/, '').split('/')[0];
        await sendFile(res, join(root, 'index.html'), appRoutes.has(firstSegment) ? 200 : 404);
    }
}).listen(port, host, () => {
    console.log(`Pilseligaen dev server: http://${host}:${port}/`);
});

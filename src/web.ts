// The web view: the page in web.html and the scan behind it, served by Node. Nothing is stored:
// each scan is answered once, like the CLI's.
import { readFileSync } from 'node:fs';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { AtlasError } from './core/errors.ts';
import { skillLink } from './core/model.ts';
import { scan, type Source } from './core/scan.ts';

const PAGE = readFileSync(new URL('./web.html', import.meta.url));

/** `GET /`: the page; `GET /api/scan?repo=<GitHub URL | directory>`: the scan, as JSON. */
export function createWebServer(open: (input: string) => Promise<Source>): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (request.method !== 'GET') return send(response, 405, 'text/plain', 'Method not allowed');
    if (url.pathname === '/') return send(response, 200, 'text/html; charset=utf-8', PAGE);
    if (url.pathname !== '/api/scan') return send(response, 404, 'text/plain', 'Not found');
    const input = url.searchParams.get('repo')?.trim();
    if (!input) return json(response, 400, { error: 'Enter a GitHub repository URL or a directory' });
    try {
      const result = await scan(await open(input));
      const skills = result.skills.map((skill) => ({ ...skill, link: skillLink(result.repository, skill) }));
      json(response, 200, { repository: result.repository, skills, warnings: result.warnings });
    } catch (error) {
      if (error instanceof AtlasError) return json(response, 400, { error: error.message });
      json(response, 500, { error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

/** Listens on the port, 0 for any free one; the page's URL. */
export function listen(server: Server, port: number, host: string): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new AtlasError(`Port ${port} is in use; try skill-atlas serve <port>`) : error);
    });
    server.listen(port, host, () => {
      const address = server.address();
      resolve(`http://localhost:${typeof address === 'object' && address ? address.port : port}`);
    });
  });
}

function json(response: ServerResponse, status: number, body: unknown) {
  send(response, status, 'application/json; charset=utf-8', JSON.stringify(body));
}

function send(response: ServerResponse, status: number, type: string, body: string | Buffer) {
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);
}

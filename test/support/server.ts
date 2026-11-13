import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/** What the server saw for one request, returned by `/echo`. */
export interface Echo {
	method: string;
	path: string;
	query: Record<string, string>;
	headers: IncomingMessage["headers"];
	body: string;
}

/** A local HTTP server with fixed routes for API tests. */
export interface TestServer {
	/** e.g. `http://127.0.0.1:53211` */
	url: string;
	close: () => Promise<void>;
}

/**
 * Starts a server on a free localhost port. Routes:
 * - `/echo`: 200, the request as JSON ({@link Echo}), any method
 * - `/items`: 200, `[{ "id": 1, "name": "first" }]`
 * - `/missing`: 404, `{ "error": "not found" }`
 * - `/html-error`: 500, an HTML page
 * - `/error-body`: 200, `{ "responseCode": 400, "message": "Bad request" }` (an error reported in a 2xx body)
 * - `/not-json`: 200, plain text
 * - `/eventually?after=N`: 503 for the first N calls since start, then 200 `{ "ready": true }`
 */
export async function startServer(): Promise<TestServer> {
	let eventuallyCalls = 0;
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => {
			const url = new URL(req.url ?? "/", "http://localhost");
			const json = (status: number, body: unknown) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(body));
			};
			switch (url.pathname) {
				case "/echo":
					return json(200, {
						method: req.method ?? "",
						path: url.pathname,
						query: Object.fromEntries(url.searchParams),
						headers: req.headers,
						body: Buffer.concat(chunks).toString("utf8")
					} satisfies Echo);
				case "/items":
					return json(200, [{ id: 1, name: "first" }]);
				case "/missing":
					return json(404, { error: "not found" });
				case "/html-error":
					res.writeHead(500, { "content-type": "text/html" });
					return res.end("<h1>Internal Server Error</h1>");
				case "/error-body":
					return json(200, { responseCode: 400, message: "Bad request" });
				case "/not-json":
					res.writeHead(200, { "content-type": "text/plain" });
					return res.end("plain text");
				case "/eventually": {
					eventuallyCalls += 1;
					const after = Number(url.searchParams.get("after") ?? 0);
					return eventuallyCalls > after ? json(200, { ready: true }) : json(503, { ready: false });
				}
				default:
					return json(404, { error: `no route ${url.pathname}` });
			}
		});
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;
	return {
		url: `http://127.0.0.1:${port}`,
		close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
	};
}

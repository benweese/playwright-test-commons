import { test, expect } from "@playwright/test";
import { ApiBase, type ApiBaseOptions } from "../src/index.js";
import { startServer, type Echo, type TestServer } from "./support/server.js";

/** A client exposing what the tests need; real clients add one method per endpoint. */
class TestClient extends ApiBase {
	constructor(options: ApiBaseOptions) {
		super(options);
	}
}

let server: TestServer;
const clients: ApiBase[] = [];

/** A client for the test server, disposed after the file's tests. */
function client(options: Partial<ApiBaseOptions> = {}): TestClient {
	const created = new TestClient({ baseUrl: server.url, ...options });
	clients.push(created);
	return created;
}

test.beforeAll(async () => {
	server = await startServer();
});

test.afterAll(async () => {
	await Promise.all(clients.map((c) => c.dispose()));
	await server.close();
});

test.describe("ApiBase", () => {
	test("rejects a bodyType other than json or form", () => {
		expect(() => new TestClient({ baseUrl: "https://example.com", bodyType: "xml" as "json" })).toThrow(
			'bodyType must be "json" or "form", got "xml"'
		);
	});

	test("uri joins the base URL and path with exactly one slash", () => {
		const api = new TestClient({ baseUrl: "https://example.com/api/" });
		expect(api.uri("products")).toBe("https://example.com/api/products");
		expect(api.uri("/products")).toBe("https://example.com/api/products");
	});

	test("get sends query params", async () => {
		const response = await client().get<Echo>("echo", { q: "shoes", page: 2 });
		const echo = await response.json();
		expect(echo).toMatchObject({ method: "GET", query: { q: "shoes", page: "2" } });
	});

	test("post, put, patch and delete send a JSON body by default", async () => {
		const api = client();
		for (const method of ["post", "put", "patch", "delete"] as const) {
			const echo = await (await api[method]<Echo>("echo", { name: "x" })).json();
			expect(echo.method, method).toBe(method.toUpperCase());
			expect(echo.headers["content-type"], method).toBe("application/json");
			expect(JSON.parse(echo.body), method).toEqual({ name: "x" });
		}
	});

	test("bodyType form sends a urlencoded body", async () => {
		const echo = await (await client({ bodyType: "form" }).post<Echo>("echo", { a: "1", b: "two words" })).json();
		expect(echo.headers["content-type"]).toBe("application/x-www-form-urlencoded");
		expect(echo.body).toBe("a=1&b=two+words");
	});

	test("a request without a payload sends no body", async () => {
		const echo = await (await client().post<Echo>("echo")).json();
		expect(echo.body).toBe("");
	});

	test("fixed headers go on every request, and per-request headers override them", async () => {
		const api = client({ headers: { "x-team": "qa", "x-env": "local" } });
		const echo = await (await api.send<Echo>("get", "echo", { headers: { "x-env": "ci" } })).json();
		expect(echo.headers).toMatchObject({ "x-team": "qa", "x-env": "ci" });
	});

	test("a headers function is called for each request, so a token set later is used", async () => {
		let token = "first";
		const api = client({ headers: () => ({ authorization: `Bearer ${token}` }) });
		expect((await (await api.get<Echo>("echo")).json()).headers.authorization).toBe("Bearer first");
		token = "second";
		expect((await (await api.get<Echo>("echo")).json()).headers.authorization).toBe("Bearer second");
	});

	test("send accepts any method case", async () => {
		const echo = await (await client().send<Echo>("pAtCh", "echo")).json();
		expect(echo.method).toBe("PATCH");
	});

	test("a non-2xx response is returned, not thrown, so the caller decides what it means", async () => {
		const api = client();
		const missing = await api.get("missing");
		expect(missing.status()).toBe(404);
		expect(await missing.json()).toEqual({ error: "not found" });
		const broken = await api.get("html-error");
		expect(broken.status()).toBe(500);
		expect(await broken.text()).toContain("Internal Server Error");
	});

	test("dispose releases the context, and the next request creates a new one", async () => {
		const api = client();
		expect((await api.get("items")).ok()).toBe(true);
		await api.dispose();
		await api.dispose(); // a second dispose is harmless
		expect((await api.get("items")).ok()).toBe(true);
	});

	test("debug logs the request, request body, status and response body", async () => {
		const lines: string[] = [];
		const original = console.log;
		console.log = (...args: unknown[]) => lines.push(args.join(" "));
		try {
			const api = client({ debug: true });
			await api.post("echo", { name: "logged" });
			await api.get("not-json");
		} finally {
			console.log = original;
		}
		const output = lines.join("\n");
		expect(output).toMatch(/REQUEST =+\nPOST http:\/\/127\.0\.0\.1:\d+\/echo/);
		expect(output).toContain('"name": "logged"');
		expect(output).toMatch(/RESPONSE =+\n200 in \d+ms/);
		expect(output).toContain("plain text"); // a body that isn't JSON is logged as text
	});

	test("without debug nothing is logged", async () => {
		const lines: unknown[] = [];
		const original = console.log;
		console.log = (...args: unknown[]) => lines.push(args);
		try {
			await client().get("items");
		} finally {
			console.log = original;
		}
		expect(lines).toEqual([]);
	});
});

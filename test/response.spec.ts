import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ApiBase, configureSchemas, errorCheck, getBody, pollUntil } from "../src/index.js";
import { startServer, type TestServer } from "./support/server.js";

interface Item {
	id: number;
	name: string;
}

let server: TestServer;
let api: ApiBase;

test.beforeAll(async () => {
	server = await startServer();
	api = new ApiBase({ baseUrl: server.url });
});

test.afterAll(async () => {
	await api.dispose();
	await server.close();
});

test.describe("getBody", () => {
	test("returns the parsed body of a 2xx response", async () => {
		const body = await getBody(await api.get<Item[]>("items"));
		expect(body).toEqual([{ id: 1, name: "first" }]);
	});

	test("checks the status only: a 200 that carries an error in its body is returned as is", async () => {
		// Some APIs report errors with HTTP 200. getBody can't know the body's meaning; a strict
		// schema (see failurePaths.spec.ts) or a check on the body's own status field catches it.
		const body = await getBody(await api.get("error-body"));
		expect(body).toEqual({ responseCode: 400, message: "Bad request" });
	});
});

test.describe("errorCheck", () => {
	test.beforeAll(async () => {
		const schemasDir = path.resolve(".tmp/response-schemas");
		await mkdir(path.join(schemasDir, "errors"), { recursive: true });
		await writeFile(
			path.join(schemasDir, "errors/error.schema.json"),
			JSON.stringify({
				type: "object",
				properties: { error: { type: "string" } },
				required: ["error"],
				additionalProperties: false
			})
		);
		configureSchemas({ schemasDir });
	});

	test("returns the parsed JSON body of the expected error", async () => {
		expect(await errorCheck(await api.get("missing"), 404)).toEqual({ error: "not found" });
	});

	test("returns the raw text when the error body isn't JSON", async () => {
		expect(await errorCheck(await api.get("html-error"), 500)).toBe("<h1>Internal Server Error</h1>");
	});

	test("validates the error body against a schema", async () => {
		expect(await errorCheck(await api.get("missing"), 404, { schema: "errors/error" })).toEqual({
			error: "not found"
		});
	});
});

test.describe("pollUntil", () => {
	test("retries non-2xx responses and unmet conditions until the condition holds", async () => {
		const local = await startServer();
		const client = new ApiBase({ baseUrl: local.url });
		let calls = 0;
		try {
			const body = await pollUntil(
				() => {
					calls += 1;
					return client.get<{ ready: boolean }>("eventually", { after: 2 });
				},
				(b) => b.ready,
				{ intervals: [10] }
			);
			expect(body).toEqual({ ready: true });
			expect(calls).toBe(3); // two 503s, then 200
		} finally {
			await client.dispose();
			await local.close();
		}
	});

	test("returns the body that met the condition", async () => {
		const body = await pollUntil(
			() => api.get<Item[]>("items"),
			(items) => items.length === 1
		);
		expect(body[0]?.name).toBe("first");
	});
});

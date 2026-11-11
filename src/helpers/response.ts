/**
 * Response helpers used by every API test.
 *
 * - getBody: assert 2xx, parse JSON, dispose.
 * - errorCheck: assert an error status, parse the body, optionally validate it against a schema.
 * - timingCheck: average response time over several calls.
 *
 * Don't add a separate `expect(response.status()).toBe(200)` next to getBody; it already checks.
 *
 * @module response
 */

import { expect, type APIResponse } from "@playwright/test";
import { validateJsonSchema } from "../validation/validateJsonSchema.js";

/**
 * Asserts 2xx, parses the JSON body and disposes the response.
 * The body's type comes from the response: a client method declared as
 * `this.get<ProductList>(...)` makes this return a ProductList.
 */
export async function getBody<T>(response: APIResponse<T>): Promise<T> {
	await expect(response, `Expected 2xx, got ${response.status()}`).toBeOK();
	const body = await response.json();
	await response.dispose();
	return body;
}

/**
 * Asserts an error status and returns the body (JSON if possible, otherwise text).
 *
 * @param options.schema - schema name to validate the error body against, e.g. "errors/error"
 */
export async function errorCheck(
	response: APIResponse<unknown>,
	status: number,
	{ schema }: { schema?: string } = {}
): Promise<unknown> {
	expect.soft(response.status(), "HTTP status").toBe(status);
	const text = await response.text();
	await response.dispose();

	let body: unknown = text;
	try {
		body = JSON.parse(text);
	} catch {
		// Not JSON (e.g. an HTML error page); return the text as-is.
	}

	if (schema) {
		await validateJsonSchema(schema, body);
	}
	return body;
}

/**
 * Calls apiCall `runs` times and asserts the average response time. The first call is
 * excluded because it includes connection setup.
 */
export async function timingCheck(
	apiCall: () => Promise<APIResponse<unknown>>,
	maxAverageMs = 1000,
	runs = 6
): Promise<void> {
	const times: number[] = [];
	for (let i = 0; i < runs; i += 1) {
		const started = Date.now();
		const response = await apiCall();
		times.push(Date.now() - started);
		await response.dispose();
	}
	const counted = times.slice(1);
	const average = counted.reduce((sum, t) => sum + t, 0) / counted.length;
	console.log(`Run times: ${times.join("ms, ")}ms. Average (excluding first): ${average.toFixed(0)}ms`);
	expect.soft(average, `Average response time over ${counted.length} runs`).toBeLessThanOrEqual(maxAverageMs);
}

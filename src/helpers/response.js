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

import { expect } from "@playwright/test";
import { validateJsonSchema } from "../validation/validateJsonSchema.js";

/**
 * @param {import("@playwright/test").APIResponse} response
 * @returns {Promise<any>} parsed JSON body
 */
export async function getBody(response) {
	await expect(response, `Expected 2xx, got ${response.status()}`).toBeOK();
	const body = await response.json();
	await response.dispose();
	return body;
}

/**
 * @param {import("@playwright/test").APIResponse} response
 * @param {number} status - expected HTTP status
 * @param {object} [options]
 * @param {string} [options.schema] - schema name to validate the error body against, e.g. "errors/error"
 * @returns {Promise<any>} parsed body (JSON if possible, otherwise text)
 */
export async function errorCheck(response, status, { schema } = {}) {
	expect.soft(response.status(), "HTTP status").toBe(status);
	const text = await response.text();
	await response.dispose();

	let body = text;
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
 *
 * @param {() => Promise<import("@playwright/test").APIResponse>} apiCall
 * @param {number} [maxAverageMs=1000]
 * @param {number} [runs=6]
 */
export async function timingCheck(apiCall, maxAverageMs = 1000, runs = 6) {
	const times = [];
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

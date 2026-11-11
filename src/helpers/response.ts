/**
 * Response helpers used by every API test.
 *
 * - getBody: assert 2xx, parse JSON, dispose.
 * - errorCheck: assert an error status, parse the body, optionally validate it against a schema.
 * - timingCheck: average response time over several calls, from Playwright's resource timing.
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

export interface TimingOptions {
	/** Calls to measure. Default 5. */
	runs?: number;
	/**
	 * Calls made first and not measured. Default 1: a server is often slower on its first request
	 * (cold caches), even once connection setup is excluded.
	 */
	warmup?: number;
}

export interface TimingResult {
	/** Average of `durations`. */
	averageMs: number;
	/** Request sent → last byte received, per measured call. Excludes DNS, TCP and TLS setup. */
	durations: number[];
	/** Request sent → first byte received (roughly the server's processing time), per measured call. */
	timeToFirstByte: number[];
}

/**
 * Measures `runs` calls with Playwright's resource timing (`response.timing()`) and asserts
 * their average. Each call is timed from the request being sent to the last byte arriving,
 * so DNS lookup, connection and TLS setup never count against the API.
 *
 * @example
 * await timingCheck(() => Products.list(), 800);
 * const { timeToFirstByte } = await timingCheck(() => Products.search("top"), 1000, { runs: 10 });
 */
export async function timingCheck(
	apiCall: () => Promise<APIResponse<unknown>>,
	maxAverageMs = 1000,
	{ runs = 5, warmup = 1 }: TimingOptions = {}
): Promise<TimingResult> {
	const durations: number[] = [];
	const timeToFirstByte: number[] = [];
	for (let i = 0; i < warmup + runs; i += 1) {
		const response = await apiCall();
		const timing = response.timing();
		await response.dispose();
		if (i < warmup) {
			continue;
		}
		// Fields are milliseconds relative to startTime, or -1 when not available.
		const sent = Math.max(timing.requestStart, 0);
		durations.push(timing.responseEnd - sent);
		timeToFirstByte.push(timing.responseStart - sent);
	}

	const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
	const averageMs = average(durations);
	const ms = (values: number[]) => values.map((v) => `${v.toFixed(0)}ms`).join(", ");
	console.log(
		`Response times (${warmup} warm-up call(s) excluded): ${ms(durations)}. Average ${averageMs.toFixed(0)}ms, ` +
			`time to first byte average ${average(timeToFirstByte).toFixed(0)}ms`
	);
	expect.soft(averageMs, `Average response time over ${runs} calls`).toBeLessThanOrEqual(maxAverageMs);
	return { averageMs, durations, timeToFirstByte };
}

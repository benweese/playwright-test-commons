/**
 * Response helpers used by every API test: {@link getBody} for success, {@link errorCheck} for
 * expected errors, and {@link timingCheck} for response times.
 *
 * @module response
 */

import { expect, type APIResponse } from "@playwright/test";
import { validateJsonSchema } from "../validation/validateJsonSchema.js";

/**
 * Asserts a 2xx status, parses the JSON body and disposes the response. Don't add a separate
 * status check next to it.
 *
 * @template T - the body's type, taken from the response: a client method declared as
 * `this.get<ProductList>(...)` makes this return a ProductList
 * @param response - the response to read
 * @returns the parsed body
 *
 * @example
 * const body = await getBody(await Products.list());
 */
export async function getBody<T>(response: APIResponse<T>): Promise<T> {
	await expect(response, `Expected 2xx, got ${response.status()}`).toBeOK();
	const body = await response.json();
	await response.dispose();
	return body;
}

/**
 * Asserts an error status (soft), disposes the response, and optionally checks the error
 * body against a schema.
 *
 * @param response - the response to check
 * @param status - the expected HTTP status, e.g. 404
 * @param options - optional checks on the error body
 * @param options.schema - schema name for the error body, e.g. `"errors/error"`
 * @returns the body: parsed JSON if it is JSON, otherwise the raw text
 *
 * @example
 * await errorCheck(await Posts.getPost("does-not-exist"), 404);
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
		// Not JSON (e.g. an HTML error page): return the text.
	}

	if (schema) {
		await validateJsonSchema(schema, body);
	}
	return body;
}

/** Settings for {@link timingCheck}. */
export interface TimingOptions {
	/** Calls to measure. Default `5`. */
	runs?: number;
	/**
	 * Calls made first and not measured. Default `1`: a server is often slower on its first
	 * request (cold caches), even with connection setup excluded.
	 */
	warmup?: number;
}

/** What {@link timingCheck} measured, in milliseconds. */
export interface TimingResult {
	/** Average of `durations`. */
	averageMs: number;
	/** Request sent → last byte received, per measured call. */
	durations: number[];
	/** Request sent → first byte received (roughly the server's processing time), per measured call. */
	timeToFirstByte: number[];
}

/**
 * Measures calls with Playwright's resource timing (`response.timing()`) and asserts (soft)
 * that their average is within a limit. Each call is timed from the request being sent to the
 * last byte arriving, so DNS lookup, connection and TLS setup never count against the API.
 * Logs each duration and the average time to first byte.
 *
 * @param apiCall - makes the request, e.g. `() => Products.list()`
 * @param maxAverageMs - the highest acceptable average. Default `1000`
 * @param options - see {@link TimingOptions}
 * @returns the measurements, for further assertions
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
		// Timing fields are relative to startTime, and -1 when not available.
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

/**
 * Poll an API call until a condition on its body is true. Use this for anything
 * eventually consistent (background jobs, caches, search indexes) instead of fixed waits.
 *
 * @module polling
 */

import { expect } from "@playwright/test";

/**
 * @param {() => Promise<import("@playwright/test").APIResponse>} apiCall
 * @param {(body: any) => boolean} condition
 * @param {object} [options]
 * @param {string} [options.message]
 * @param {number[]} [options.intervals=[500, 1000, 2000]] - waits between attempts (last one repeats)
 * @param {number} [options.timeout=10000]
 * @returns {Promise<any>} the body that satisfied the condition
 *
 * @example
 * const post = await pollUntil(
 *   () => Posts.getPost(id),
 *   (body) => body.status === "published",
 *   { message: "post to be published" }
 * );
 */
export async function pollUntil(apiCall, condition, options = {}) {
	const { message = "condition to be met", intervals = [500, 1000, 2000], timeout = 10000 } = options;
	let body;

	await expect
		.poll(
			async () => {
				const response = await apiCall();
				if (!response.ok()) {
					await response.dispose();
					return false;
				}
				body = await response.json();
				await response.dispose();
				return condition(body);
			},
			{ message: `Waiting for ${message}`, intervals, timeout }
		)
		.toBe(true);

	return body;
}

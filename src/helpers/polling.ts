/**
 * Poll an API call until a condition on its body is true. Use this for anything
 * eventually consistent (background jobs, caches, search indexes) instead of fixed waits.
 *
 * @module polling
 */

import { expect, type APIResponse } from "@playwright/test";

export interface PollOptions {
	/** Shown in the failure message: "Waiting for <message>". */
	message?: string;
	/** Waits between attempts in ms; the last one repeats. Default [500, 1000, 2000]. */
	intervals?: number[];
	/** Total time to wait in ms. Default 10000. */
	timeout?: number;
}

/**
 * @returns the body that satisfied the condition
 *
 * @example
 * const post = await pollUntil<Post>(
 *   () => Posts.getPost(id),
 *   (body) => body.status === "published",
 *   { message: "post to be published" }
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers name the body type when they need it
export async function pollUntil<T = any>(
	apiCall: () => Promise<APIResponse>,
	condition: (body: T) => boolean,
	{ message = "condition to be met", intervals = [500, 1000, 2000], timeout = 10000 }: PollOptions = {}
): Promise<T> {
	let body: T | undefined;

	await expect
		.poll(
			async () => {
				const response = await apiCall();
				if (!response.ok()) {
					await response.dispose();
					return false;
				}
				body = (await response.json()) as T;
				await response.dispose();
				return condition(body);
			},
			{ message: `Waiting for ${message}`, intervals, timeout }
		)
		.toBe(true);

	return body as T;
}

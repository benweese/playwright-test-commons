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
 * // Posts.getPost is declared as this.get<Post>(...), so body is a Post
 * const post = await pollUntil(
 *   () => Posts.getPost(id),
 *   (body) => body.status === "published",
 *   { message: "post to be published" }
 * );
 */
export async function pollUntil<T>(
	apiCall: () => Promise<APIResponse<T>>,
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
				body = await response.json();
				await response.dispose();
				return condition(body);
			},
			{ message: `Waiting for ${message}`, intervals, timeout }
		)
		.toBe(true);

	return body as T;
}

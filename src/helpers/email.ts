/**
 * Unique email addresses for test data.
 *
 * @module email
 */

import { randomBytes } from "node:crypto";

/** Where {@link uniqueEmail} addresses go. */
export interface UniqueEmailOptions {
	/** A domain the test repo controls, so nothing is ever sent to a real stranger. */
	domain: string;
	/** The part before the `+`. Default `"test"`. */
	localPart?: string;
}

/**
 * Builds an email address no other test or run has used: `<localPart>+<timestamp>.<random>@<domain>`.
 * Plus addressing keeps every address in one mailbox on the domain.
 *
 * @param options - see {@link UniqueEmailOptions}
 * @returns e.g. `test+1767225600000.a1b2c3@example.com`
 *
 * @example
 * const email = uniqueEmail({ localPart: "playwright", domain: "example.com" });
 */
export function uniqueEmail({ domain, localPart = "test" }: UniqueEmailOptions): string {
	return `${localPart}+${Date.now()}.${randomBytes(3).toString("hex")}@${domain}`;
}

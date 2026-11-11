/**
 * Test naming and tags.
 *
 * Every test title is built with generateTestDescription so it carries a stable test id
 * and its tags. The id is a number, unique across the whole test repo, shown as "#" plus
 * at least four digits (12 → "#0012"). It ties the automated test back to its scenario in
 * the plan file (plans/<feature>.md), which holds the written steps.
 *
 * Ids say nothing about the kind of test. Tags do that: @smoke, @api, @ui select the
 * Playwright project, and @regression, @a11y, @slow describe the test.
 *
 * Run one test by its id:
 *   npx playwright test --grep "#0012"
 *
 * @module testDescription
 */

/** Tags select which Playwright project runs a test (see the consuming repo's playwright.config.ts). */
export const TAGS = {
	SMOKE: "@smoke", // fast checks that the site is up; run after every deploy
	REGRESSION: "@regression", // full functional coverage
	API: "@api",
	UI: "@ui",
	A11Y: "@a11y", // accessibility checks
	SLOW: "@slow" // excluded from quick local runs
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

export interface TestDescription {
	/** The scenario's number from the plan, unique across the repo, e.g. 12 for #0012. */
	id: number;
	/** What the test checks, in plain words. */
	description: string;
	tags?: readonly Tag[];
}

/**
 * Formats a test id for titles, plans and --grep: 12 → "#0012".
 * Padding to a fixed width means "#0012" can never match "#00120" or "#0112" in a grep.
 */
export function formatTestId(id: number): string {
	if (!Number.isInteger(id) || id < 1) {
		throw new Error(`Test id ${JSON.stringify(id)} must be a positive whole number, e.g. 12`);
	}
	return `#${String(id).padStart(4, "0")}`;
}

/** @returns e.g. "#0012 | shows the latest post first @ui @regression" */
export function generateTestDescription({ id, description, tags = [] }: TestDescription): string {
	return `${formatTestId(id)} | ${description} ${tags.join(" ")}`.trim();
}

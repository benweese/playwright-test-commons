/**
 * Test naming and tags.
 *
 * Every test title is built with generateTestDescription so it carries a stable test id
 * and its tags. The id ties the automated test back to its scenario in the plan file
 * (plans/<feature>.md), which holds the written steps. Grep on the id to run one test:
 *   npm test -- --grep "HOME-003"
 *
 * @module testDescription
 */

/** Tags select which Playwright project runs a test (see the consuming repo's playwright.config.js). */
export const TAGS = {
	SMOKE: "@smoke", // fast checks that the site is up; run after every deploy
	REGRESSION: "@regression", // full functional coverage
	API: "@api",
	UI: "@ui",
	A11Y: "@a11y", // accessibility checks
	SLOW: "@slow" // excluded from quick local runs
};

/**
 * @param {object} params
 * @param {string} params.id - stable scenario id from the plan, e.g. "HOME-003"
 * @param {string} params.description - what the test checks, in plain words
 * @param {string[]} [params.tags=[]] - values from TAGS
 * @returns {string} e.g. "HOME-003 | shows the latest post first @ui @regression"
 */
export function generateTestDescription({ id, description, tags = [] }) {
	if (!id || !/^[A-Z][A-Z0-9]*-\d{3,}$/.test(id)) {
		throw new Error(`Test id "${id}" must look like AREA-001 (capital letters, a dash, 3+ digits)`);
	}
	return `${id} | ${description} ${tags.join(" ")}`.trim();
}

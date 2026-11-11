/**
 * The rules behind the `check-test-ids` command: every test has an id, no id is used twice
 * across the repo, and every test runs in at least one Playwright project.
 *
 * @module checkTestIds
 */

import { formatTestId } from "../helpers/testDescription.js";

/** One `test()` call, as `playwright test --list --reporter=json` reports it. */
export interface ListedTest {
	/** The test's title, e.g. `"#0012 | lists products @api"`. */
	title: string;
	/** Path relative to the test directory. */
	file: string;
	line: number;
}

/** What {@link findTestIdProblems} found. */
export interface TestIdReport {
	/** One message per problem; empty when everything is fine. */
	problems: string[];
	/** Every id found, sorted, without duplicates. */
	ids: number[];
}

const ID = /^#(\d{4,}) \|/;

/**
 * Checks a repo's tests for id problems.
 *
 * @param tests - every test in the repo, whatever project would run it
 * @param scheduled - `file:line` of every test the repo's real projects run
 * @returns the problems found, and the ids in use
 *
 * @example
 * const { problems } = findTestIdProblems(allTests, new Set(["smoke/site-up.spec.ts:10"]));
 */
export function findTestIdProblems(tests: readonly ListedTest[], scheduled: ReadonlySet<string>): TestIdReport {
	const byId = new Map<number, string[]>();
	const problems: string[] = [];

	for (const test of tests) {
		const where = `${test.file}:${test.line}`;
		if (!scheduled.has(where)) {
			problems.push(`Runs in no project (missing a project tag?): ${where}  "${test.title}"`);
		}
		const match = ID.exec(test.title);
		if (!match?.[1]) {
			problems.push(`No test id (use generateTestDescription): ${where}  "${test.title}"`);
			continue;
		}
		const id = Number(match[1]);
		byId.set(id, [...(byId.get(id) ?? []), where]);
	}

	for (const [id, places] of byId) {
		if (places.length > 1) {
			problems.push(`${formatTestId(id)} is used more than once:\n  ${places.join("\n  ")}`);
		}
	}

	return { problems, ids: [...byId.keys()].sort((a, b) => a - b) };
}

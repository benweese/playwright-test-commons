import { test, expect } from "@playwright/test";
import { findTestIdProblems, type ListedTest } from "../src/tools/checkTestIds.js";

const smoke: ListedTest = { title: "#0001 | home page responds @smoke", file: "smoke/site-up.spec.ts", line: 10 };
const api: ListedTest = { title: "#0002 | lists products @api", file: "api/products.spec.ts", line: 5 };

/** The `file:line` keys of tests, as the scheduled set expects them. */
function keys(...tests: ListedTest[]): Set<string> {
	return new Set(tests.map((t) => `${t.file}:${t.line}`));
}

test.describe("findTestIdProblems", () => {
	test("passes unique ids that every project runs, and reports them sorted", () => {
		expect(findTestIdProblems([api, smoke], keys(api, smoke))).toEqual({ problems: [], ids: [1, 2] });
	});

	test("reports a test with no id", () => {
		const untitled = { title: "loads @smoke", file: "smoke/a.spec.ts", line: 3 };
		const { problems } = findTestIdProblems([untitled], keys(untitled));
		expect(problems).toEqual([expect.stringContaining("No test id")]);
	});

	test("reports an id used in two files", () => {
		const copy = { ...api, file: "api/other.spec.ts", line: 9 };
		const { problems } = findTestIdProblems([api, copy], keys(api, copy));
		expect(problems).toEqual([
			expect.stringMatching(
				/#0002 is used more than once:\n {2}api\/products.spec.ts:5\n {2}api\/other.spec.ts:9/
			)
		]);
	});

	test("reports a test that no project runs", () => {
		const { problems } = findTestIdProblems([smoke, api], keys(smoke));
		expect(problems).toEqual([expect.stringContaining("Runs in no project")]);
	});
});

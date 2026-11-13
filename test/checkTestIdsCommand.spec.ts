/**
 * The `check-test-ids` command, end to end: builds the package, then runs the compiled command
 * against two small test repos in test/fixtures. The rules themselves are unit tested in
 * checkTestIds.spec.ts.
 */
import { test, expect } from "@playwright/test";
import { execFile } from "child_process";
import { promisify } from "util";

const run = promisify(execFile);

/** Runs the built command and returns its exit code and output. */
async function checkTestIds(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !/^(TEST_|PW_|PLAYWRIGHT_)/.test(key))
	);
	try {
		const { stdout, stderr } = await run("node", ["dist/bin/check-test-ids.js", ...args], { env });
		return { code: 0, stdout, stderr };
	} catch (error) {
		const { code = 1, stdout = "", stderr = "" } = error as { code?: number; stdout?: string; stderr?: string };
		return { code, stdout, stderr };
	}
}

test.describe("check-test-ids command", () => {
	test.describe.configure({ timeout: 120_000 });

	test.beforeAll(async () => {
		await run("npx", ["tsc", "-p", "tsconfig.json"]);
	});

	test("passes a repo whose ids are unique and scheduled, and prints the highest id", async () => {
		const result = await checkTestIds("test/fixtures/ids-clean/playwright.config.ts");
		expect(result).toEqual({ code: 0, stdout: "2 test ids, all unique. Highest: #0007\n", stderr: "" });
	});

	test("fails a repo with a duplicate id, a missing id and a test no project runs", async () => {
		const { code, stderr } = await checkTestIds("test/fixtures/ids-broken/playwright.config.ts");
		expect(code).toBe(1);
		expect(stderr).toContain('No test id (use generateTestDescription): second.spec.ts:4  "has no id @api"');
		expect(stderr).toContain(
			'Runs in no project (missing a project tag?): second.spec.ts:5  "#0003 | runs in no project"'
		);
		expect(stderr).toMatch(/#0002 is used more than once:\n {2}first\.spec\.ts:4\n {2}second\.spec\.ts:3/);
	});

	test("reports Playwright's own error when the config can't be loaded", async () => {
		const { code, stderr } = await checkTestIds("test/fixtures/does-not-exist.config.ts");
		expect(code).toBe(1);
		expect(stderr).toContain("Playwright could not list the tests");
	});
});

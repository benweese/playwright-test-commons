#!/usr/bin/env node
/**
 * `check-test-ids [playwright config]`: fails if a test has no id, an id is used more than
 * once, or a test runs in no project. Run it from the test repo, e.g. as part of `npm run lint`.
 * The config defaults to `playwright.config.ts` in the current directory.
 *
 * It lists the tests twice with Playwright: once with the repo's own config, to see which tests
 * its projects run, and once with every test file in a single project, to see every test. A test
 * in the second list but not the first runs in no project.
 *
 * @module check-test-ids
 */

import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { formatTestId } from "../helpers/testDescription.js";
import { findTestIdProblems, type ListedTest } from "../tools/checkTestIds.js";

interface Suite {
	specs?: ListedTest[];
	suites?: Suite[];
}

/** Every test() call in a listing, with its suites flattened. */
function* specs(suite: Suite): Generator<ListedTest> {
	yield* suite.specs ?? [];
	for (const child of suite.suites ?? []) {
		yield* specs(child);
	}
}

/** The error messages in a JSON report, e.g. a spec that doesn't compile; empty if there are none. */
function listingErrors(output: string): string {
	try {
		const { errors = [] } = JSON.parse(output) as { errors?: { message?: string }[] };
		return errors.map((error) => error.message ?? "").join("\n");
	} catch {
		return "";
	}
}

/**
 * Lists the tests a Playwright config would run, without running them.
 *
 * @throws Error with Playwright's own message if it can't load the config or the tests
 */
function list(config: string, cwd: string): ListedTest[] {
	let output: string;
	try {
		output = execFileSync("npx", ["playwright", "test", "--list", "--reporter=json", `--config=${config}`], {
			cwd,
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"]
		});
	} catch (error) {
		const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
		throw new Error(`Playwright could not list the tests:\n${listingErrors(stdout) || stderr || stdout}`.trim(), {
			cause: error
		});
	}
	const report = JSON.parse(output) as { suites: Suite[] };
	return report.suites.flatMap((suite) => [...specs(suite)]);
}

/**
 * A config that runs every test file in one project: the repo's config, with its projects
 * replaced by one that matches Playwright's default spec pattern plus every project's testMatch.
 */
function everyTestConfig(configPath: string): string {
	return `import base from ${JSON.stringify(configPath)};
import path from "path";

const dir = ${JSON.stringify(path.dirname(configPath))};
const testMatch = [
	/\\.(spec|test)\\.[cm]?[jt]sx?$/,
	...(base.projects ?? []).flatMap((project) => (project.testMatch ? [project.testMatch].flat() : []))
];

export default {
	...base,
	testDir: path.resolve(dir, base.testDir ?? "."),
	projects: [{ name: "every-test", testMatch }]
};
`;
}

const configPath = path.resolve(process.argv[2] ?? "playwright.config.ts");
const cwd = path.dirname(configPath);
const tmp = mkdtempSync(path.join(os.tmpdir(), "check-test-ids-"));

try {
	// .mts makes it an ES module wherever it is, so it can import the repo's ESM config.
	const everyTest = path.join(tmp, "every-test.config.mts");
	writeFileSync(everyTest, everyTestConfig(configPath));

	const scheduled = new Set(list(configPath, cwd).map((test) => `${test.file}:${test.line}`));
	const { problems, ids } = findTestIdProblems(list(everyTest, cwd), scheduled);

	if (problems.length) {
		console.error(problems.join("\n"));
		process.exitCode = 1;
	} else {
		const highest = ids.at(-1);
		console.log(`${ids.length} test ids, all unique. Highest: ${highest ? formatTestId(highest) : "none"}`);
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	rmSync(tmp, { recursive: true, force: true });
}

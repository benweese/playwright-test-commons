/**
 * Failure paths: what a test author sees when a check fails. A failing soft check fails the test
 * it runs in, so the failing checks live in test/fixtures/failing and run here in a separate
 * Playwright run. Each case asserts that its fixture test failed, with how many errors and what
 * each one says.
 */
import { test, expect } from "@playwright/test";
import { execFile } from "child_process";
import { promisify, stripVTControlCharacters } from "util";

interface Result {
	status: string;
	errors: string[];
}

interface Suite {
	specs?: { title: string; tests: { results: { status: string; errors: { message?: string }[] }[] }[] }[];
	suites?: Suite[];
}

/** One expected failure: the fixture test's status and a pattern for each error, in order. */
interface Expected {
	status?: "failed" | "timedOut";
	errors: (string | RegExp)[];
}

const expected: Record<string, Expected> = {
	"pollUntil timeout": {
		errors: [/Waiting for the job to finish[\s\S]*Timeout 300ms exceeded while waiting on the predicate/]
	},
	"schema mismatch: wrong types": {
		errors: [
			/Response matches schema "items"[\s\S]*"body\[0\]\.id: must be integer, got \\"7\\""[\s\S]*"body\[0\]\.price: must be number, got \\"12\.50\\""[\s\S]*"body\[0\]\.tags\[1\]: must be string, got 3"/
		]
	},
	"schema mismatch: missing field and value outside enum": {
		errors: [
			/"body: missing field \\"id\\""[\s\S]*"body\.status: must be one of \[\\"draft\\",\\"published\\"\], got \\"archived\\""/
		]
	},
	"schema mismatch: unexpected extra fields": {
		errors: [/"body: unexpected field \\"extra\\""[\s\S]*"body: unexpected field \\"with\/slash\\""/]
	},
	"schema file missing": {
		errors: [/ENOENT: no such file or directory, open '.*does\/not\/exist\.schema\.json'/]
	},
	"invalid date in a validated body": {
		errors: ['body.createdAt "2026-02-30" is a valid ISO 8601 date']
	},
	"invalid dates in the date checks": {
		errors: [
			'leapDay "2025-02-29" is a valid ISO 8601 date',
			'deliveryDate "2026-01-31" is a valid DD/MM/YYYY date',
			'date "20260131" is a valid ISO 8601 date',
			/publishedAt "2027-01-01" is between 2026-01-0[12]T\S+ and 2026-12-3[01]T\S+/,
			/date "not a date" is between/,
			"items[1].at (2026-03-01) is not after items[0].at (2026-01-01)",
			"items[1].at (2026-01-01) is not before items[0].at (2026-03-01)"
		]
	},
	"getBody on a non-2xx response": {
		errors: [/Expected 2xx, got 404[\s\S]*← 404 Not Found/]
	},
	"errorCheck with the wrong status": {
		errors: [/HTTP status[\s\S]*Expected: 400\s+Received: 404/]
	},
	"errorCheck with an error body that breaks its schema": {
		errors: [
			/"body: missing field \\"id\\""[\s\S]*"body: missing field \\"status\\""[\s\S]*"body: unexpected field \\"error\\""/
		]
	},
	"200 with an error body": {
		errors: [
			/Response matches schema "item"[\s\S]*"body: unexpected field \\"responseCode\\""[\s\S]*"body: unexpected field \\"message\\""/
		]
	},
	"BasePage soft checks keep going and report every failure": {
		errors: [
			/^Error: results panel[\s\S]*toBeVisible/,
			/^Error: search box[\s\S]*Expected: "boots"\s+Received: "shoes"/,
			/^Error: result rows[\s\S]*Expected: 3\s+Received: 1/,
			/toHaveText[\s\S]*Expected: "Other"\s+Received: "Title"/
		]
	},
	"BasePage soft: false stops at the first failure": {
		errors: [/^Error: heading[\s\S]*toBeHidden/]
	},
	"BasePage clickAndHandleDialog with no dialog": {
		status: "timedOut",
		errors: ["Test timeout of 3000ms exceeded", /waiting for event "dialog"/]
	},
	"accessibility violations": {
		errors: [
			/axe violations on about:blank[\s\S]*"button-name \(critical\) on 1 element\(s\): button"[\s\S]*"image-alt \(critical\) on 3 element\(s\): img\[src=\\"a\.png\\"\] \| img\[src=\\"b\.png\\"\] \| and 1 more"/
		]
	}
};

const results = new Map<string, Result>();

/** Every spec in a JSON report, with its suites flattened. */
function specs(suite: Suite): NonNullable<Suite["specs"]> {
	return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specs)];
}

test.beforeAll(async () => {
	test.setTimeout(120_000);
	// Drop the outer run's worker variables so the inner run starts clean.
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([key]) => !/^(TEST_|PW_|PLAYWRIGHT_)/.test(key))
	);
	const run = await promisify(execFile)(
		"npx",
		["playwright", "test", "--config", "test/fixtures/failing/playwright.config.ts"],
		{ env: { ...env, FORCE_COLOR: "0" }, maxBuffer: 32 * 1024 * 1024 }
	).catch((error: { stdout?: string; stderr?: string }) => error);
	let report: { suites: Suite[] };
	try {
		report = JSON.parse(run.stdout ?? "");
	} catch {
		throw new Error(`The failing-fixtures run produced no JSON report:\n${run.stderr ?? ""}`);
	}
	for (const spec of report.suites.flatMap(specs)) {
		const result = spec.tests[0]?.results[0];
		results.set(spec.title, {
			status: result?.status ?? "missing",
			errors: (result?.errors ?? []).map((e) => stripVTControlCharacters(e.message ?? ""))
		});
	}
});

test("every failing fixture has an expectation here, and the other way round", () => {
	expect([...results.keys()].sort()).toEqual(Object.keys(expected).sort());
});

for (const [title, { status = "failed", errors }] of Object.entries(expected)) {
	test(`fails readably: ${title}`, () => {
		const result = results.get(title);
		expect(result, `fixture "${title}" ran`).toBeDefined();
		expect(result?.status).toBe(status);
		expect(result?.errors, result?.errors.join("\n---\n")).toHaveLength(errors.length);
		errors.forEach((pattern, i) => {
			const message = result?.errors[i] ?? "";
			if (typeof pattern === "string") {
				expect(message, `error ${i + 1}`).toContain(pattern);
			} else {
				expect(message, `error ${i + 1}`).toMatch(pattern);
			}
		});
	});
}

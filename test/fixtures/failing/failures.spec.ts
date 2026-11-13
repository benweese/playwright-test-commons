/**
 * Every test here is meant to fail. test/failurePaths.spec.ts runs this file in its own
 * Playwright run and checks each test failed with a readable message. Titles are the keys it
 * looks up, so change them in both places.
 */
import { test } from "@playwright/test";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
	ApiBase,
	BasePage,
	configureSchemas,
	errorCheck,
	expectDateBetween,
	expectNoA11yViolations,
	expectSortedByDate,
	expectValidDate,
	getBody,
	pollUntil,
	validateJsonSchema
} from "../../../src/index.js";
import { startServer, type TestServer } from "../../support/server.js";

let server: TestServer;
let api: ApiBase;

test.beforeAll(async () => {
	server = await startServer();
	api = new ApiBase({ baseUrl: server.url });
	const schemasDir = path.resolve(".tmp/failing-schemas");
	await mkdir(schemasDir, { recursive: true });
	const item = {
		type: "object",
		properties: {
			id: { type: "integer" },
			status: { enum: ["draft", "published"] },
			price: { type: "number" },
			createdAt: { type: "string" },
			tags: { type: "array", items: { type: "string" } }
		},
		required: ["id", "status"],
		additionalProperties: false
	};
	await writeFile(path.join(schemasDir, "item.schema.json"), JSON.stringify(item));
	await writeFile(path.join(schemasDir, "items.schema.json"), JSON.stringify({ type: "array", items: item }));
	configureSchemas({ schemasDir });
});

test.afterAll(async () => {
	await api.dispose();
	await server.close();
});

test("pollUntil timeout", async () => {
	await pollUntil(
		() => api.get<{ ready: boolean }>("eventually", { after: 1_000 }),
		(body) => body.ready,
		{ message: "the job to finish", intervals: [50], timeout: 300 }
	);
});

test("schema mismatch: wrong types", async () => {
	await validateJsonSchema("items", [{ id: "7", status: "draft", price: "12.50", tags: ["a", 3] }]);
});

test("schema mismatch: missing field and value outside enum", async () => {
	await validateJsonSchema("item", { status: "archived" });
});

test("schema mismatch: unexpected extra fields", async () => {
	await validateJsonSchema("item", { id: 1, status: "draft", extra: true, "with/slash": 1 });
});

test("schema file missing", async () => {
	await validateJsonSchema("does/not/exist", {});
});

test("invalid date in a validated body", async () => {
	await validateJsonSchema("item", { id: 1, status: "draft", createdAt: "2026-02-30" });
});

test("invalid dates in the date checks", async () => {
	expectValidDate("2025-02-29", { label: "leapDay" });
	expectValidDate("2026-01-31", { format: "DD/MM/YYYY", label: "deliveryDate" });
	expectValidDate(20260131);
	expectDateBetween("2027-01-01", "2026-01-01", "2026-12-31", { label: "publishedAt" });
	expectDateBetween("not a date", "2026-01-01", "2026-12-31");
	expectSortedByDate([{ at: "2026-01-01" }, { at: "2026-03-01" }, { at: "2026-02-01" }], "at", "desc");
	expectSortedByDate([{ at: "2026-03-01" }, { at: "2026-01-01" }], "at", "asc");
});

test("getBody on a non-2xx response", async () => {
	await getBody(await api.get("missing"));
});

test("errorCheck with the wrong status", async () => {
	await errorCheck(await api.get("missing"), 400);
});

test("errorCheck with an error body that breaks its schema", async () => {
	await errorCheck(await api.get("missing"), 404, { schema: "item" });
});

test("200 with an error body", async () => {
	// getBody passes (the status is 200); the strict success schema catches the error body.
	const body = await getBody(await api.get("error-body"));
	await validateJsonSchema("item", body);
});

test("BasePage soft checks keep going and report every failure", async ({ page }) => {
	await page.setContent(`<h1>Title</h1><input id="q" value="shoes"><ul><li>a</li></ul>`);
	const base = new BasePage(page);
	await base.expectVisible(page.locator("#nope"), "results panel");
	await base.expectValue(page.locator("#q"), "boots", "search box");
	await base.expectCount(page.locator("li"), 3, "result rows");
	await base.expectText(page.locator("h1"), "Other");
});

test("BasePage soft: false stops at the first failure", async ({ page }) => {
	await page.setContent(`<h1>Title</h1>`);
	const base = new BasePage(page);
	await base.expectHidden(page.locator("h1"), "heading", { soft: false });
	await base.expectVisible(page.locator("#never-reached"), "never reached");
});

test("BasePage clickAndHandleDialog with no dialog", async ({ page }) => {
	test.setTimeout(3_000);
	await page.setContent(`<button>Save</button>`);
	await new BasePage(page).clickAndHandleDialog(page.getByRole("button"));
});

test("accessibility violations", async ({ page }) => {
	await page.setContent(
		`<html lang="en"><head><title>A11y</title></head><body><main>` +
			`<img src="a.png"><img src="b.png"><img src="c.png"><button></button>` +
			`</main></body></html>`
	);
	await expectNoA11yViolations(page, { maxTargetsShown: 2 });
});

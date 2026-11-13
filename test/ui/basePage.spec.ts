import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { writeFile } from "fs/promises";
import { BasePage } from "../../src/index.js";

const ORIGIN = "http://commons.test";

const FORM = `<!doctype html>
<title>Form page</title>
<h1>  Products  </h1>
<label>Email <input id="email" type="email" required></label>
<label>Size <select id="size"><option value="s">Small</option><option value="l">Large</option></select></label>
<input id="files" type="file" multiple>
<button id="hidden" hidden>Hidden</button>
<ul><li> one </li><li>two</li></ul>
<button id="alert" onclick="alert('Saved!')">Alert</button>
<button id="confirm" onclick="document.body.dataset.answer = String(confirm('Sure?'))">Confirm</button>
<button id="prompt" onclick="document.body.dataset.answer = prompt('Name?')">Prompt</button>
<button id="load" onclick="fetch('/api/items').then(r => r.json()).then(d => document.body.dataset.items = d.length)">Load</button>`;

/** Serves every page under {@link ORIGIN} from memory: the form page, plus a small JSON endpoint. */
async function serve(page: Page): Promise<void> {
	await page.route(`${ORIGIN}/**`, (route) => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/items") {
			return route.fulfill({ json: [1, 2, 3] });
		}
		return route.fulfill({ contentType: "text/html", body: FORM });
	});
}

/** The page under test: plain BasePage with the page's locators. */
const locators = (page: Page) => ({
	heading: page.getByRole("heading"),
	email: page.locator("#email"),
	size: page.locator("#size"),
	files: page.locator("#files"),
	hidden: page.locator("#hidden"),
	rows: page.getByRole("listitem"),
	alert: page.locator("#alert"),
	confirm: page.locator("#confirm"),
	prompt: page.locator("#prompt"),
	load: page.locator("#load")
});

test.use({ baseURL: ORIGIN });

let form: BasePage<ReturnType<typeof locators>>;

test.beforeEach(async ({ page }) => {
	await serve(page);
	form = new BasePage(page, locators);
	await form.goto("/products?q=shoes&page=2");
});

test.describe("BasePage", () => {
	test("works without a locator factory", ({ page }) => {
		expect(new BasePage(page).locators).toEqual({});
	});

	test("goto and reload return the main response; the URL, title and query string are readable", async () => {
		expect((await form.goto())?.status()).toBe(200);
		await form.goto("/products?q=shoes&page=2");
		expect((await form.reload())?.url()).toBe(`${ORIGIN}/products?q=shoes&page=2`);
		await form.waitForLoad();
		await form.expectUrl(/[?&]q=shoes/);
		await form.expectTitle("Form page");
		expect(form.searchParams()).toEqual({ q: "shoes", page: "2" });
	});

	test("reads text, trimmed", async () => {
		expect(await form.getText(form.locators.heading)).toBe("Products");
		expect(await form.getAllTexts(form.locators.rows)).toEqual(["one", "two"]);
		await form.expectText(form.locators.rows, ["one", "two"]);
	});

	test("fills fields and selects options; the value checks see them", async () => {
		await form.fill(form.locators.email, "a@example.com");
		await form.expectValue(form.locators.email, "a@example.com", "email");
		await form.fill(form.locators.email, 42);
		await form.expectValue(form.locators.email, "42");
		await form.selectOption(form.locators.size, "Large");
		await form.expectValue(form.locators.size, "l", "size", { soft: false });
	});

	test("expectInvalid passes on a field the browser's own validation rejects", async () => {
		await form.expectInvalid(form.locators.email, "empty required email");
		await form.fill(form.locators.email, "not-an-email");
		await form.expectInvalid(form.locators.email, "malformed email", { soft: false, timeout: 2_000 });
	});

	test("visibility and count checks", async () => {
		await form.expectVisible(form.locators.heading, "heading");
		await form.expectHidden(form.locators.hidden, "hidden button", { soft: false });
		await form.expectCount(form.locators.rows, 2, "rows");
		await form.expectCount(form.locators.hidden.locator("span"), 0);
		await form.expectAny(form.locators.rows, "rows", { timeout: 2_000 });
	});

	test("uploadFiles chooses files and expectFilesAttached sees their names; [] clears them", async () => {
		const first = test.info().outputPath("first.txt");
		const second = test.info().outputPath("second.txt");
		await writeFile(first, "1");
		await writeFile(second, "2");
		await form.uploadFiles(form.locators.files, [first, second]);
		await form.expectFilesAttached(form.locators.files, ["first.txt", "second.txt"], "two files");
		await form.uploadFiles(form.locators.files, first);
		await form.expectFilesAttached(form.locators.files, ["first.txt"]);
		await form.uploadFiles(form.locators.files, []);
		await form.expectFilesAttached(form.locators.files, []);
	});

	test("clickAndHandleDialog accepts by default and returns the dialog", async ({ page }) => {
		expect(await form.clickAndHandleDialog(form.locators.alert)).toEqual({ type: "alert", message: "Saved!" });
		expect(await form.clickAndHandleDialog(form.locators.confirm)).toEqual({ type: "confirm", message: "Sure?" });
		await expect(page.locator("body")).toHaveAttribute("data-answer", "true");
	});

	test("clickAndHandleDialog can dismiss, or accept a prompt with text", async ({ page }) => {
		await form.clickAndHandleDialog(form.locators.confirm, "dismiss");
		await expect(page.locator("body")).toHaveAttribute("data-answer", "false");
		await form.clickAndHandleDialog(form.locators.prompt, "accept", "Ada");
		await expect(page.locator("body")).toHaveAttribute("data-answer", "Ada");
	});

	test("recordDialogs dismisses every dialog and records its message", async ({ page }) => {
		const messages = form.recordDialogs();
		await form.click(form.locators.alert);
		await form.click(form.locators.confirm);
		await expect(page.locator("body")).toHaveAttribute("data-answer", "false");
		expect(messages).toEqual(["Saved!", "Sure?"]);
	});

	test("clickAndWaitForResponse returns the response the click triggered", async ({ page }) => {
		const response = await form.clickAndWaitForResponse(form.locators.load, (r) => r.url().endsWith("/api/items"));
		expect(await response.json()).toEqual([1, 2, 3]);
		await expect(page.locator("body")).toHaveAttribute("data-items", "3");
		await form.clickAndWaitForResponse(form.locators.load, /\/api\/items$/);
	});
});

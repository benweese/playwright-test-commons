/**
 * Base class for page objects.
 *
 * UI tests use three layers per page:
 *   tests/ui/locators/<name>Locators.js  – a factory (page) => ({ ...locators })
 *   tests/ui/pages/<name>Page.js         – extends BasePage; one method per user action
 *   tests/ui/specs/<name>.spec.js        – calls page methods and asserts; no raw locators
 *
 * Page objects call these methods (this.click, this.fill, ...) rather than raw Playwright,
 * so waits and logging stay consistent. Add a method here only when every page could use it
 * and it takes locators as arguments; anything with page-specific names belongs on the page object.
 *
 * @module BasePage
 */

import { expect } from "@playwright/test";

export class BasePage {
	/**
	 * @param {import("@playwright/test").Page} page
	 * @param {(page: import("@playwright/test").Page) => Record<string, import("@playwright/test").Locator>} [locatorFactory]
	 */
	constructor(page, locatorFactory) {
		this.page = page;
		this.locators = locatorFactory ? locatorFactory(page) : {};
	}

	/** Navigates relative to the project's baseURL (set in playwright.config.js), never a hardcoded host. */
	async goto(path = "/") {
		await this.page.goto(path);
		await this.page.waitForLoadState("domcontentloaded");
	}

	async click(locator) {
		await expect(locator).toBeVisible();
		await locator.click();
	}

	async fill(locator, value) {
		await expect(locator).toBeEditable();
		await locator.fill(String(value));
	}

	async selectOption(locator, label) {
		await locator.selectOption({ label });
	}

	async getText(locator) {
		await expect(locator).toBeVisible();
		return (await locator.innerText()).trim();
	}

	async getAllTexts(locator) {
		return (await locator.allInnerTexts()).map((t) => t.trim());
	}

	/**
	 * Soft by default, so one run reports every failed check. Pass { soft: false } when later
	 * steps depend on it (e.g. confirming a login succeeded before saving the session).
	 */
	async expectVisible(locator, message, { soft = true } = {}) {
		await (soft ? expect.soft : expect)(locator, message).toBeVisible();
	}

	async expectHidden(locator, message, { soft = true } = {}) {
		await (soft ? expect.soft : expect)(locator, message).toBeHidden();
	}

	async expectText(locator, text) {
		await expect.soft(locator).toHaveText(text);
	}

	async expectUrl(pattern) {
		await expect.soft(this.page).toHaveURL(pattern);
	}

	/** Current query string as an object, for asserting URL state after filters/search. */
	searchParams() {
		return Object.fromEntries(new URL(this.page.url()).searchParams);
	}
}

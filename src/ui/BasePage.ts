/**
 * Base class for page objects.
 *
 * UI tests use three layers per page:
 *   tests/ui/locators/<name>Locators.ts  – a factory (page) => ({ ...locators })
 *   tests/ui/pages/<Name>Page.ts         – extends BasePage; one method per user action
 *   tests/ui/specs/<name>.spec.ts        – calls page methods and asserts; no raw locators
 *
 * Page objects call these methods (this.click, this.fill, ...) rather than raw Playwright,
 * so waits and logging stay consistent. Add a method here only when every page could use it
 * and it takes locators as arguments; anything with page-specific names belongs on the page object.
 *
 * @module BasePage
 */

import { expect, type Locator, type Page, type Response } from "@playwright/test";

/** Builds a page's locators: `export const homeLocators = (page: Page) => ({ ... })`. */
export type LocatorFactory<L> = (page: Page) => L;

export interface ExpectOptions {
	/** Soft by default; pass false when later steps depend on the check. */
	soft?: boolean;
}

/**
 * @typeParam L - the page's locators, usually `ReturnType<typeof homeLocators>`
 */
export class BasePage<L extends object = Record<string, Locator>> {
	readonly page: Page;
	readonly locators: L;

	constructor(page: Page, locatorFactory?: LocatorFactory<L>) {
		this.page = page;
		this.locators = locatorFactory ? locatorFactory(page) : ({} as L);
	}

	/**
	 * Navigates relative to the project's baseURL (set in playwright.config.ts), never a hardcoded host.
	 * Waits for domcontentloaded, not load: a stalled third-party script (ads, analytics) can hold
	 * the load event for ever, and web-first assertions wait for the elements a test needs anyway.
	 */
	async goto(path = "/"): Promise<Response | null> {
		return this.page.goto(path, { waitUntil: "domcontentloaded" });
	}

	async click(locator: Locator): Promise<void> {
		await expect(locator).toBeVisible();
		await locator.click();
	}

	async fill(locator: Locator, value: string | number): Promise<void> {
		await expect(locator).toBeEditable();
		await locator.fill(String(value));
	}

	async selectOption(locator: Locator, label: string): Promise<void> {
		await locator.selectOption({ label });
	}

	async getText(locator: Locator): Promise<string> {
		await expect(locator).toBeVisible();
		return (await locator.innerText()).trim();
	}

	async getAllTexts(locator: Locator): Promise<string[]> {
		return (await locator.allInnerTexts()).map((t) => t.trim());
	}

	/**
	 * Soft by default, so one run reports every failed check. Pass { soft: false } when later
	 * steps depend on it (e.g. confirming a login succeeded before saving the session).
	 */
	async expectVisible(locator: Locator, message?: string, { soft = true }: ExpectOptions = {}): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeVisible();
	}

	async expectHidden(locator: Locator, message?: string, { soft = true }: ExpectOptions = {}): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeHidden();
	}

	async expectText(locator: Locator, text: string | RegExp | ReadonlyArray<string | RegExp>): Promise<void> {
		await expect.soft(locator).toHaveText(text);
	}

	async expectUrl(pattern: string | RegExp): Promise<void> {
		await expect.soft(this.page).toHaveURL(pattern);
	}

	/** Current query string as an object, for asserting URL state after filters/search. */
	searchParams(): Record<string, string> {
		return Object.fromEntries(new URL(this.page.url()).searchParams);
	}
}

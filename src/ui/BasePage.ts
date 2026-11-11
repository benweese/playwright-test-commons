/**
 * Base class for page objects.
 *
 * UI tests use three layers per page:
 * - `tests/ui/locators/<name>Locators.ts`: a factory, `(page: Page) => ({ ...locators })`
 * - `tests/ui/pages/<Name>Page.ts`: extends BasePage, one method per user action
 * - `tests/ui/specs/<name>.spec.ts`: calls page methods and asserts, with no raw locators
 *
 * @module BasePage
 */

import { expect, type Locator, type Page, type Response } from "@playwright/test";

/**
 * Builds a page's locators.
 *
 * @example
 * export const homeLocators = (page: Page) => ({
 * 	searchBox: page.getByRole("searchbox", { name: "Search" })
 * });
 */
export type LocatorFactory<L> = (page: Page) => L;

/** Options for the visibility checks on {@link BasePage}. */
export interface ExpectOptions {
	/** Soft (the test continues on failure) by default. Pass `false` when later steps depend on the check. */
	soft?: boolean;
}

/**
 * Base class for page objects. Page methods call these helpers (`this.click`, `this.fill`, ...)
 * rather than raw Playwright, so waits stay consistent. Add a helper here only when every page
 * could use it and it takes locators as arguments; anything with page-specific names belongs on
 * the page object.
 *
 * @template L - the page's locators, usually `ReturnType<typeof homeLocators>`
 *
 * @example
 * export class LoginPage extends BasePage<LoginLocators> {
 * 	constructor(page: Page) {
 * 		super(page, loginLocators);
 * 	}
 *
 * 	async login(email: string, password: string) {
 * 		await this.fill(this.locators.emailInput, email);
 * 		await this.fill(this.locators.passwordInput, password);
 * 		await this.click(this.locators.loginButton);
 * 	}
 * }
 */
export class BasePage<L extends object = Record<string, Locator>> {
	/** The Playwright page this object drives. */
	readonly page: Page;
	/** The page's locators, built by the factory passed to the constructor. */
	readonly locators: L;

	/**
	 * @param page - the Playwright page
	 * @param locatorFactory - builds the page's locators; omit for a page with none
	 */
	constructor(page: Page, locatorFactory?: LocatorFactory<L>) {
		this.page = page;
		this.locators = locatorFactory ? locatorFactory(page) : ({} as L);
	}

	/**
	 * Navigates to a path relative to the project's `baseURL`. Waits for `domcontentloaded`, not
	 * `load`: a stalled third-party script (ads, analytics) can hold back the load event
	 * indefinitely, and web-first assertions wait for the elements a test needs anyway.
	 *
	 * @param path - e.g. `"/login"`. Default `"/"`
	 * @returns the main resource response, or null (see Playwright's `page.goto`)
	 */
	async goto(path = "/"): Promise<Response | null> {
		return this.page.goto(path, { waitUntil: "domcontentloaded" });
	}

	/**
	 * Waits for an element to be visible, then clicks it.
	 *
	 * @param locator - the element to click
	 */
	async click(locator: Locator): Promise<void> {
		await expect(locator).toBeVisible();
		await locator.click();
	}

	/**
	 * Waits for a field to be editable, then replaces its value.
	 *
	 * @param locator - the input, textarea or editable element
	 * @param value - the text to enter; numbers are converted to text
	 */
	async fill(locator: Locator, value: string | number): Promise<void> {
		await expect(locator).toBeEditable();
		await locator.fill(String(value));
	}

	/**
	 * Selects a dropdown option by its visible label.
	 *
	 * @param locator - the `<select>` element
	 * @param label - the option's visible text
	 */
	async selectOption(locator: Locator, label: string): Promise<void> {
		await locator.selectOption({ label });
	}

	/**
	 * Waits for an element to be visible and returns its text.
	 *
	 * @param locator - the element to read
	 * @returns the element's visible text, trimmed
	 */
	async getText(locator: Locator): Promise<string> {
		await expect(locator).toBeVisible();
		return (await locator.innerText()).trim();
	}

	/**
	 * Returns the text of every element a locator matches. Does not wait: use it after the
	 * elements are known to be on the page.
	 *
	 * @param locator - matches zero or more elements
	 * @returns each element's visible text, trimmed
	 */
	async getAllTexts(locator: Locator): Promise<string[]> {
		return (await locator.allInnerTexts()).map((t) => t.trim());
	}

	/**
	 * Asserts an element is visible.
	 *
	 * @param locator - the element to check
	 * @param message - shown if the check fails
	 * @param options - soft by default, so one run reports every failed check; see {@link ExpectOptions}
	 */
	async expectVisible(locator: Locator, message?: string, { soft = true }: ExpectOptions = {}): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeVisible();
	}

	/**
	 * Asserts an element is hidden or not on the page.
	 *
	 * @param locator - the element to check
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectHidden(locator: Locator, message?: string, { soft = true }: ExpectOptions = {}): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeHidden();
	}

	/**
	 * Asserts (soft) an element's text.
	 *
	 * @param locator - the element, or elements, to check
	 * @param text - the expected text; an array checks each matched element in order
	 */
	async expectText(locator: Locator, text: string | RegExp | ReadonlyArray<string | RegExp>): Promise<void> {
		await expect.soft(locator).toHaveText(text);
	}

	/**
	 * Asserts (soft) the page's URL.
	 *
	 * @param pattern - the full URL, or a pattern such as `/[?&]q=shoes/`
	 */
	async expectUrl(pattern: string | RegExp): Promise<void> {
		await expect.soft(this.page).toHaveURL(pattern);
	}

	/**
	 * The current query string, for checking URL state after a search or filter.
	 *
	 * @returns e.g. `{ q: "shoes", page: "2" }`
	 */
	searchParams(): Record<string, string> {
		return Object.fromEntries(new URL(this.page.url()).searchParams);
	}
}

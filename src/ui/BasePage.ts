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

/** Options for the checks on {@link BasePage}. */
export interface ExpectOptions {
	/** Soft (the test continues on failure) by default. Pass `false` when later steps depend on the check. */
	soft?: boolean;
	/** How long to wait, in milliseconds. Defaults to the project's `expect.timeout`. Raise it only for something known to be slow. */
	timeout?: number;
}

/** A browser dialog (alert, confirm, prompt or beforeunload) the page opened. */
export interface DialogInfo {
	/** `"alert"`, `"confirm"`, `"prompt"` or `"beforeunload"`. */
	type: string;
	/** The dialog's text. */
	message: string;
}

/** What to do with a dialog: accept it (OK) or dismiss it (Cancel). */
export type DialogAction = "accept" | "dismiss";

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
	async expectVisible(
		locator: Locator,
		message?: string,
		{ soft = true, timeout }: ExpectOptions = {}
	): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeVisible({ timeout });
	}

	/**
	 * Asserts an element is hidden or not on the page.
	 *
	 * @param locator - the element to check
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectHidden(
		locator: Locator,
		message?: string,
		{ soft = true, timeout }: ExpectOptions = {}
	): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toBeHidden({ timeout });
	}

	/**
	 * Asserts how many elements a locator matches.
	 *
	 * @param locator - matches zero or more elements
	 * @param count - the expected number; `0` checks that none are on the page
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectCount(
		locator: Locator,
		count: number,
		message?: string,
		{ soft = true, timeout }: ExpectOptions = {}
	): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toHaveCount(count, { timeout });
	}

	/**
	 * Asserts a locator matches at least one element, e.g. that a results list isn't empty.
	 *
	 * @param locator - matches zero or more elements
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectAny(locator: Locator, message?: string, { soft = true, timeout }: ExpectOptions = {}): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).not.toHaveCount(0, { timeout });
	}

	/**
	 * Asserts a form control's current value.
	 *
	 * @param locator - the input, textarea or select
	 * @param value - the expected value; `""` for an empty field
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectValue(
		locator: Locator,
		value: string | RegExp,
		message?: string,
		{ soft = true, timeout }: ExpectOptions = {}
	): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).toHaveValue(value, { timeout });
	}

	/**
	 * Asserts a form control fails the browser's own validation (`required`, `type="email"`, ...),
	 * i.e. its `validationMessage` is not empty. The wording differs per browser and language, so
	 * it is never compared.
	 *
	 * @param locator - the input, select or textarea
	 * @param message - shown if the check fails
	 * @param options - soft by default; see {@link ExpectOptions}
	 */
	async expectInvalid(
		locator: Locator,
		message?: string,
		{ soft = true, timeout }: ExpectOptions = {}
	): Promise<void> {
		await (soft ? expect.soft : expect)(locator, message).not.toHaveJSProperty("validationMessage", "", {
			timeout
		});
	}

	/**
	 * Asserts the names of the files chosen in a file input.
	 *
	 * @param locator - the `<input type="file">`
	 * @param names - the expected file names, in order; `[]` for none
	 * @param message - shown if the check fails
	 */
	async expectFilesAttached(locator: Locator, names: string[], message?: string): Promise<void> {
		await expect.soft
			.poll(
				() =>
					locator.evaluate((input) =>
						Array.from((input as HTMLInputElement).files ?? [], (file) => file.name)
					),
				{ message }
			)
			.toEqual(names);
	}

	/**
	 * Asserts (soft) the page's title.
	 *
	 * @param title - the full title, or a pattern
	 */
	async expectTitle(title: string | RegExp): Promise<void> {
		await expect.soft(this.page).toHaveTitle(title);
	}

	/**
	 * Reloads the page. Waits for `domcontentloaded`, like {@link BasePage.goto}.
	 *
	 * @returns the main resource response, or null (see Playwright's `page.reload`)
	 */
	async reload(): Promise<Response | null> {
		return this.page.reload({ waitUntil: "domcontentloaded" });
	}

	/**
	 * Waits for the page's `load` event. {@link BasePage.goto} only waits for `domcontentloaded`, so
	 * use this before acting on a control whose handler is bound by a script at the end of the
	 * page: until that script runs, the control is visible but a click does nothing.
	 */
	async waitForLoad(): Promise<void> {
		await this.page.waitForLoadState("load");
	}

	/**
	 * Clicks an element and waits for the response it triggers, for actions whose only visible
	 * result comes after a request (an item removed, a list refreshed).
	 *
	 * @param locator - the element to click
	 * @param url - the response to wait for: a URL, a pattern, or a predicate
	 * @returns the response
	 *
	 * @example
	 * await this.clickAndWaitForResponse(this.locators.removeButton(name), (r) => r.url().endsWith(`/delete_cart/${id}`));
	 */
	async clickAndWaitForResponse(
		locator: Locator,
		url: string | RegExp | ((response: Response) => boolean | Promise<boolean>)
	): Promise<Response> {
		const response = this.page.waitForResponse(url);
		await this.click(locator);
		return response;
	}

	/**
	 * Chooses files in a file input.
	 *
	 * @param locator - the `<input type="file">`
	 * @param files - one path or several; `[]` clears the input
	 */
	async uploadFiles(locator: Locator, files: string | string[]): Promise<void> {
		await locator.setInputFiles(files);
	}

	/**
	 * Clicks an element that opens a browser dialog, answers the dialog and returns what it said.
	 * Fails if no dialog opens within the action timeout.
	 *
	 * @param locator - the element to click
	 * @param action - accept (OK) or dismiss (Cancel). Default `"accept"`
	 * @param promptText - the text to enter when accepting a prompt
	 * @returns the dialog's type and message
	 *
	 * @example
	 * const dialog = await this.clickAndHandleDialog(this.locators.submitButton, "dismiss");
	 */
	async clickAndHandleDialog(
		locator: Locator,
		action: DialogAction = "accept",
		promptText?: string
	): Promise<DialogInfo> {
		const handled = this.page.waitForEvent("dialog").then(async (dialog) => {
			await (action === "accept" ? dialog.accept(promptText) : dialog.dismiss());
			return { type: dialog.type(), message: dialog.message() };
		});
		await this.click(locator);
		return handled;
	}

	/**
	 * From now on, dismisses every dialog the page opens and records its message, for checking
	 * later that none opened. Without a listener Playwright dismisses dialogs silently, so they
	 * would go unnoticed.
	 *
	 * @returns a list that fills as dialogs open; assert it is empty when no dialog was expected
	 */
	recordDialogs(): string[] {
		const messages: string[] = [];
		this.page.on("dialog", (dialog) => {
			messages.push(dialog.message());
			void dialog.dismiss();
		});
		return messages;
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

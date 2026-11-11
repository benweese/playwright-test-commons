/**
 * Base class for API clients.
 *
 * Each API area gets one client class that extends ApiBase and is exported as a singleton.
 * Specs call client methods, never `request` directly, so URLs, headers and logging live in
 * one place.
 *
 * @module ApiBase
 */

import { request, type APIRequestContext, type APIResponse } from "@playwright/test";

/** HTTP headers sent with every request. */
export type Headers = Record<string, string>;

/** How request bodies are encoded: `"json"` (application/json) or `"form"` (application/x-www-form-urlencoded). */
export type BodyType = "json" | "form";

/** Options Playwright's `APIRequestContext.fetch` accepts: params, data, form, multipart, headers, timeout, ... */
export type FetchOptions = NonNullable<Parameters<APIRequestContext["fetch"]>[1]>;

/** Settings for an {@link ApiBase} client. */
export interface ApiBaseOptions {
	/** API root, e.g. `"https://example.com/api"`. A trailing slash is removed. */
	baseUrl: string;
	/**
	 * Headers for every request: a fixed object, or a function called per request. Use a function
	 * for auth tokens that only exist after the client is created, e.g. set by a setup project.
	 */
	headers?: Headers | (() => Headers);
	/** How post, put, patch and delete send their body. Default `"json"`. */
	bodyType?: BodyType;
	/** Log every request and response body to the console. Default `false`. */
	debug?: boolean;
}

/**
 * Base class for one-client-per-API-area. Subclass it, add one method per endpoint, and
 * export a single instance.
 *
 * Name each response body's type in the method (`this.get<ProductList>(...)`), as Playwright's
 * own request methods allow. `getBody`, `pollUntil` and `response.json()` then return that type
 * without the spec repeating it.
 *
 * @example
 * class ProductsClient extends ApiBase {
 * 	constructor() {
 * 		super({ baseUrl: "https://example.com/api", bodyType: "form" });
 * 	}
 *
 * 	list() {
 * 		return this.get<ProductList>("productsList");
 * 	}
 * }
 *
 * export const Products = new ProductsClient();
 */
export class ApiBase {
	protected readonly baseUrl: string;
	protected readonly headers: Headers | (() => Headers);
	protected readonly bodyType: BodyType;
	protected readonly debug: boolean;
	private context: APIRequestContext | null = null;

	/**
	 * @param options - see {@link ApiBaseOptions}
	 * @throws Error if `bodyType` is not `"json"` or `"form"`
	 */
	constructor({ baseUrl, headers = {}, bodyType = "json", debug = false }: ApiBaseOptions) {
		if (!["json", "form"].includes(bodyType)) {
			throw new Error(`bodyType must be "json" or "form", got "${bodyType}"`);
		}
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.headers = headers;
		this.bodyType = bodyType;
		this.debug = debug;
	}

	/** The headers for the next request, calling the headers function if one was given. */
	protected resolveHeaders(): Headers {
		return typeof this.headers === "function" ? this.headers() : this.headers;
	}

	/**
	 * Builds the full URL for a path.
	 *
	 * @param path - relative to the base URL; a leading slash is ignored
	 * @returns e.g. `"https://example.com/api/products"` for `"products"`
	 */
	uri(path: string): string {
		return `${this.baseUrl}/${path.replace(/^\//, "")}`;
	}

	/** Logs a labelled value when `debug` is on. */
	protected log(label: string, value: unknown): void {
		if (this.debug) {
			console.log(`=================== ${label} ===================`);
			console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
		}
	}

	/** The client's request context: created on first use, then reused for every request in the worker. */
	protected async requestContext(): Promise<APIRequestContext> {
		this.context ??= await request.newContext();
		return this.context;
	}

	/** Releases the request context. Optional: call it from an `afterAll` if a worker creates many clients. */
	async dispose(): Promise<void> {
		await this.context?.dispose();
		this.context = null;
	}

	/**
	 * Sends a request. The caller asserts on the response, usually through `getBody` or
	 * `errorCheck`, which also dispose it.
	 *
	 * @template T - the response body's type
	 * @param method - HTTP method, any case
	 * @param path - relative to the base URL
	 * @param options - Playwright fetch options; their headers are merged over the client's
	 * @returns the response, typed as `APIResponse<T>`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	async send<T = any>(method: string, path: string, options: FetchOptions = {}): Promise<APIResponse<T>> {
		const url = this.uri(path);
		this.log("REQUEST", `${method.toUpperCase()} ${url}`);
		const payload = options.data ?? options.form;
		if (payload !== undefined) {
			this.log("REQUEST BODY", payload);
		}

		const context = await this.requestContext();
		const started = Date.now();
		const response = await context.fetch<T>(url, {
			...options,
			method: method.toUpperCase(),
			headers: { ...this.resolveHeaders(), ...options.headers }
		});
		this.log("RESPONSE", `${response.status()} in ${Date.now() - started}ms`);
		if (this.debug) {
			try {
				this.log("RESPONSE BODY", await response.json());
			} catch {
				this.log("RESPONSE BODY", await response.text());
			}
		}
		return response;
	}

	/** Wraps a payload as `data` (JSON) or `form`, depending on the client's `bodyType`. */
	protected body(payload: unknown): FetchOptions {
		if (payload === undefined) {
			return {};
		}
		return this.bodyType === "form"
			? { form: payload as FetchOptions["form"] }
			: { data: payload as FetchOptions["data"] };
	}

	/**
	 * Sends a GET request.
	 *
	 * @template T - the response body's type
	 * @param path - relative to the base URL
	 * @param params - query string parameters
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	get<T = any>(path: string, params?: FetchOptions["params"]): Promise<APIResponse<T>> {
		return this.send<T>("get", path, { params });
	}

	/**
	 * Sends a POST request.
	 *
	 * @template T - the response body's type
	 * @param path - relative to the base URL
	 * @param payload - request body, encoded as the client's `bodyType`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	post<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("post", path, this.body(payload));
	}

	/**
	 * Sends a PUT request.
	 *
	 * @template T - the response body's type
	 * @param path - relative to the base URL
	 * @param payload - request body, encoded as the client's `bodyType`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	put<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("put", path, this.body(payload));
	}

	/**
	 * Sends a PATCH request.
	 *
	 * @template T - the response body's type
	 * @param path - relative to the base URL
	 * @param payload - request body, encoded as the client's `bodyType`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	patch<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("patch", path, this.body(payload));
	}

	/**
	 * Sends a DELETE request.
	 *
	 * @template T - the response body's type
	 * @param path - relative to the base URL
	 * @param payload - request body, encoded as the client's `bodyType`
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	delete<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("delete", path, this.body(payload));
	}
}

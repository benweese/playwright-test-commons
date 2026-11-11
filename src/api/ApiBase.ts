/**
 * Base class for API clients.
 *
 * Each API area gets one client class that extends ApiBase and is exported as a
 * singleton. Specs call client methods, never `request` directly, so URLs, headers
 * and logging live in one place.
 *
 * @module ApiBase
 */

import { request, type APIRequestContext, type APIResponse } from "@playwright/test";

export type Headers = Record<string, string>;
export type BodyType = "json" | "form";
/** Options Playwright's fetch accepts: params, data, form, multipart, headers, timeout, ... */
export type FetchOptions = NonNullable<Parameters<APIRequestContext["fetch"]>[1]>;

export interface ApiBaseOptions {
	/** API root, e.g. config.apiBaseUrl */
	baseUrl: string;
	/**
	 * Static headers, or a function called per request (use a function for auth tokens that
	 * are set after the client is created, e.g. by a setup project).
	 */
	headers?: Headers | (() => Headers);
	/** How post/put/patch/delete send their body: JSON or application/x-www-form-urlencoded. Default "json". */
	bodyType?: BodyType;
	/** Log request and response bodies. */
	debug?: boolean;
}

export class ApiBase {
	protected readonly baseUrl: string;
	protected readonly headers: Headers | (() => Headers);
	protected readonly bodyType: BodyType;
	protected readonly debug: boolean;
	private context: APIRequestContext | null = null;

	constructor({ baseUrl, headers = {}, bodyType = "json", debug = false }: ApiBaseOptions) {
		if (!["json", "form"].includes(bodyType)) {
			throw new Error(`bodyType must be "json" or "form", got "${bodyType}"`);
		}
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.headers = headers;
		this.bodyType = bodyType;
		this.debug = debug;
	}

	protected resolveHeaders(): Headers {
		return typeof this.headers === "function" ? this.headers() : this.headers;
	}

	uri(path: string): string {
		return `${this.baseUrl}/${path.replace(/^\//, "")}`;
	}

	protected log(label: string, value: unknown): void {
		if (this.debug) {
			console.log(`=================== ${label} ===================`);
			console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
		}
	}

	/** One request context per client (per worker), created on first use and reused. */
	protected async requestContext(): Promise<APIRequestContext> {
		this.context ??= await request.newContext();
		return this.context;
	}

	/** Releases the request context. Optional: call it from an afterAll if a worker makes many clients. */
	async dispose(): Promise<void> {
		await this.context?.dispose();
		this.context = null;
	}

	/**
	 * Sends a request and returns the Playwright APIResponse. The caller asserts on it
	 * (usually through getBody or errorCheck), which also disposes it.
	 *
	 * T types the response body, as Playwright's own request methods do: name it once in the
	 * client method (`this.get<ProductList>("productsList")`) and getBody, pollUntil and
	 * `response.json()` all return that type.
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

	/** Wraps a body as `data` or `form`, depending on bodyType. */
	protected body(payload: unknown): FetchOptions {
		if (payload === undefined) {
			return {};
		}
		return this.bodyType === "form"
			? { form: payload as FetchOptions["form"] }
			: { data: payload as FetchOptions["data"] };
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	get<T = any>(path: string, params?: FetchOptions["params"]): Promise<APIResponse<T>> {
		return this.send<T>("get", path, { params });
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	post<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("post", path, this.body(payload));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	put<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("put", path, this.body(payload));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	patch<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("patch", path, this.body(payload));
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same default as Playwright's APIResponse<T>
	delete<T = any>(path: string, payload?: unknown): Promise<APIResponse<T>> {
		return this.send<T>("delete", path, this.body(payload));
	}
}

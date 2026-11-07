/**
 * Base class for API clients.
 *
 * Each API area gets one client class that extends ApiBase and is exported as a
 * singleton. Specs call client methods, never `request` directly, so URLs, headers
 * and logging live in one place.
 *
 * @module ApiBase
 */

import { request } from "@playwright/test";

export class ApiBase {
	/**
	 * @param {object} options
	 * @param {string} options.baseUrl - API root, e.g. config.apiBaseUrl
	 * @param {Record<string, string> | (() => Record<string, string>)} [options.headers] -
	 *   static headers, or a function called per request (use a function for auth tokens that
	 *   are set after the client is created, e.g. by a setup project)
	 * @param {"json" | "form"} [options.bodyType="json"] - how post/put/patch/delete send their body:
	 *   "json" (application/json) or "form" (application/x-www-form-urlencoded)
	 * @param {boolean} [options.debug=false] - log request/response bodies
	 */
	constructor({ baseUrl, headers = {}, bodyType = "json", debug = false }) {
		if (!["json", "form"].includes(bodyType)) {
			throw new Error(`bodyType must be "json" or "form", got "${bodyType}"`);
		}
		this.baseUrl = baseUrl.replace(/\/$/, "");
		this.headers = headers;
		this.bodyType = bodyType;
		this.debug = debug;
		this.context = null;
	}

	resolveHeaders() {
		return typeof this.headers === "function" ? this.headers() : this.headers;
	}

	uri(path) {
		return `${this.baseUrl}/${String(path).replace(/^\//, "")}`;
	}

	log(label, value) {
		if (this.debug) {
			console.log(`=================== ${label} ===================`);
			console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
		}
	}

	/** One request context per client (per worker), created on first use and reused. */
	async requestContext() {
		this.context ??= await request.newContext();
		return this.context;
	}

	/** Releases the request context. Optional: call it from an afterAll if a worker makes many clients. */
	async dispose() {
		await this.context?.dispose();
		this.context = null;
	}

	/**
	 * Sends a request and returns the Playwright APIResponse. The caller asserts on it
	 * (usually through getBody or errorCheck), which also disposes it.
	 *
	 * @param {string} method
	 * @param {string} path - relative to baseUrl
	 * @param {object} [options] - Playwright fetch options (params, data, form, multipart, headers, ...)
	 */
	async send(method, path, options = {}) {
		const url = this.uri(path);
		this.log("REQUEST", `${method.toUpperCase()} ${url}`);
		const payload = options.data ?? options.form;
		if (payload !== undefined) {
			this.log("REQUEST BODY", payload);
		}

		const context = await this.requestContext();
		const started = Date.now();
		const response = await context.fetch(url, {
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
	body(payload) {
		if (payload === undefined) {
			return {};
		}
		return this.bodyType === "form" ? { form: payload } : { data: payload };
	}

	get(path, params) {
		return this.send("get", path, { params });
	}

	post(path, payload) {
		return this.send("post", path, this.body(payload));
	}

	put(path, payload) {
		return this.send("put", path, this.body(payload));
	}

	patch(path, payload) {
		return this.send("patch", path, this.body(payload));
	}

	delete(path, payload) {
		return this.send("delete", path, this.body(payload));
	}
}

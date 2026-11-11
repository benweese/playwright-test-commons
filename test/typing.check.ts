/**
 * Compile-time checks, run by `npm run lint` (tsc). Not a Playwright test: if the response
 * typing regresses, these lines stop compiling.
 */
import type { APIResponse } from "@playwright/test";
import { ApiBase, getBody, pollUntil } from "../src/index.js";

interface Product {
	id: number;
	name: string;
}

class ProductsClient extends ApiBase {
	list() {
		return this.get<Product[]>("products");
	}
}

declare const products: ProductsClient;
declare const response: APIResponse<Product>;

// getBody returns the type the client method declared, without naming it again.
export const list: Promise<Product[]> = products.list().then(getBody);
export const one: Promise<Product> = getBody(response);
export const polled: Promise<Product[]> = pollUntil(
	() => products.list(),
	(body) => body.length > 0
);

// @ts-expect-error a body typed as Product[] is not a Product
export const wrong: Promise<Product> = products.list().then(getBody);

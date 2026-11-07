/**
 * Public surface of @benweese/playwright-test-commons.
 *
 * This barrel is curated on purpose: a new file is NOT public until its export is added here.
 * Nothing in this package does work at import time (no network, no file reads), so importing
 * it is always safe and cheap.
 *
 * @module commons
 */

export { createConfig } from "./config.js";
export { ApiBase } from "./api/ApiBase.js";
export { TAGS, generateTestDescription } from "./helpers/testDescription.js";
export { getBody, errorCheck, timingCheck } from "./helpers/response.js";
export { pollUntil } from "./helpers/polling.js";
export { validateJsonSchema, configureSchemas } from "./validation/validateJsonSchema.js";
export { createJsonSchema, schemaFilePath } from "./validation/createJsonSchema.js";
export {
	isIsoDate,
	expectValidDate,
	expectDateBetween,
	expectSortedByDate,
	validateDatesInBody
} from "./validation/validateDates.js";
export { BasePage } from "./ui/BasePage.js";

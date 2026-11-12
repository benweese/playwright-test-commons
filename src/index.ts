/**
 * Public API of `@benweese/playwright-test-commons`.
 *
 * Only what is exported here is public; a new file stays internal until it is added. Nothing
 * runs at import time (no network, no file reads), so importing the package is always safe.
 *
 * @module playwright-test-commons
 */

export { ApiBase } from "./api/ApiBase.js";
export type { ApiBaseOptions, BodyType, FetchOptions, Headers } from "./api/ApiBase.js";
export { TAGS, generateTestDescription, formatTestId } from "./helpers/testDescription.js";
export type { Tag, TestDescription } from "./helpers/testDescription.js";
export { getBody, errorCheck, timingCheck } from "./helpers/response.js";
export type { TimingOptions, TimingResult } from "./helpers/response.js";
export { pollUntil } from "./helpers/polling.js";
export type { PollOptions } from "./helpers/polling.js";
export { validateJsonSchema, configureSchemas } from "./validation/validateJsonSchema.js";
export type { SchemaSettings, ValidateOptions } from "./validation/validateJsonSchema.js";
export { createJsonSchema, schemaFilePath } from "./validation/createJsonSchema.js";
export {
	isIsoDate,
	expectValidDate,
	expectDateBetween,
	expectSortedByDate,
	validateDatesInBody
} from "./validation/validateDates.js";
export type { DateInput, DateOptions, DateCheckOptions } from "./validation/validateDates.js";
export { uniqueEmail } from "./helpers/email.js";
export type { UniqueEmailOptions } from "./helpers/email.js";
export { BasePage } from "./ui/BasePage.js";
export type { LocatorFactory, ExpectOptions, DialogInfo, DialogAction } from "./ui/BasePage.js";
export { WCAG_AA_TAGS, scanA11y, expectNoA11yViolations } from "./ui/accessibility.js";
export type { A11yOptions, A11yViolation } from "./ui/accessibility.js";

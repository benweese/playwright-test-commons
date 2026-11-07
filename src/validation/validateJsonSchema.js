/**
 * JSON Schema validation for API responses.
 *
 * Schemas live as files: <schemasDir>/<name>.schema.json, where name can include folders,
 * e.g. "posts/getPost" → schemas/posts/getPost.schema.json. schemasDir defaults to
 * `<cwd>/schemas` and can be changed once with configureSchemas().
 *
 * Every validation also runs validateDatesInBody, so date fields are checked for free.
 *
 * Creating a schema for a new endpoint: call with { update: true } once (or run the tests
 * with UPDATE_SCHEMAS=true), review the generated file, commit it, then remove the flag.
 * Leaving the flag on rewrites the schema from every response and hides real changes.
 *
 * @module validateJsonSchema
 */

import { expect } from "@playwright/test";
import { readFile } from "fs/promises";
import path from "path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { createJsonSchema, schemaFilePath } from "./createJsonSchema.js";
import { validateDatesInBody } from "./validateDates.js";

const settings = {
	schemasDir: path.join(process.cwd(), "schemas"),
	dateOptions: {}
};

// allErrors: report every mismatch at once, so one run shows the whole picture.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/** Compiled validators, cached per schema name for the life of the worker. */
const validators = new Map();

/**
 * @param {object} options
 * @param {string} [options.schemasDir] - absolute path to the schemas folder
 * @param {object} [options.dateOptions] - passed to validateDatesInBody (see validateDates.js)
 */
export function configureSchemas({ schemasDir, dateOptions } = {}) {
	if (schemasDir) {
		settings.schemasDir = schemasDir;
	}
	if (dateOptions) {
		settings.dateOptions = dateOptions;
	}
	validators.clear();
}

async function loadValidator(name) {
	if (!validators.has(name)) {
		const file = schemaFilePath(settings.schemasDir, name);
		const schema = JSON.parse(await readFile(file, "utf8"));
		validators.set(name, ajv.compile(schema));
	}
	return validators.get(name);
}

/**
 * @param {string} name - schema name, e.g. "posts/getPost"
 * @param {unknown} body - parsed response body
 * @param {object} [options]
 * @param {boolean} [options.update=false] - (re)generate the schema from this body first
 * @param {boolean} [options.checkDates=true] - also run validateDatesInBody
 */
export async function validateJsonSchema(name, body, { update = false, checkDates = true } = {}) {
	if (update || process.env.UPDATE_SCHEMAS === "true") {
		await createJsonSchema(settings.schemasDir, name, body);
		validators.delete(name);
	}

	const validate = await loadValidator(name);
	const valid = validate(body);
	if (!valid) {
		console.error(`Schema "${name}" errors:\n${JSON.stringify(validate.errors, null, 2)}`);
	}
	// Soft, so the rest of the test still runs and reports its own failures.
	expect.soft(valid, `Response matches schema "${name}"`).toBe(true);

	if (checkDates) {
		validateDatesInBody(body, settings.dateOptions);
	}
}

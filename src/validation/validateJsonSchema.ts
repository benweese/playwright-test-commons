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
import { Ajv, type ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";
import { createJsonSchema, schemaFilePath } from "./createJsonSchema.js";
import { validateDatesInBody, type DateOptions } from "./validateDates.js";

// ajv-formats is CommonJS: at runtime the default import is the plugin function itself.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

const settings: { schemasDir: string; dateOptions: DateOptions } = {
	schemasDir: path.join(process.cwd(), "schemas"),
	dateOptions: {}
};

// allErrors: report every mismatch at once, so one run shows the whole picture.
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/** Compiled validators, cached per schema name for the life of the worker. */
const validators = new Map<string, ValidateFunction>();

export interface SchemaSettings {
	/** Absolute path to the schemas folder. */
	schemasDir?: string;
	/** Passed to validateDatesInBody on every validation. */
	dateOptions?: DateOptions;
}

export function configureSchemas({ schemasDir, dateOptions }: SchemaSettings = {}): void {
	if (schemasDir) {
		settings.schemasDir = schemasDir;
	}
	if (dateOptions) {
		settings.dateOptions = dateOptions;
	}
	validators.clear();
}

async function loadValidator(name: string): Promise<ValidateFunction> {
	let validate = validators.get(name);
	if (!validate) {
		const file = schemaFilePath(settings.schemasDir, name);
		validate = ajv.compile(JSON.parse(await readFile(file, "utf8")));
		validators.set(name, validate);
	}
	return validate;
}

export interface ValidateOptions {
	/** (Re)generate the schema from this body first. Never commit this. */
	update?: boolean;
	/** Also run validateDatesInBody. Default true. */
	checkDates?: boolean;
}

/**
 * @param name - schema name, e.g. "posts/getPost"
 * @param body - parsed response body
 */
export async function validateJsonSchema(
	name: string,
	body: unknown,
	{ update = false, checkDates = true }: ValidateOptions = {}
): Promise<void> {
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

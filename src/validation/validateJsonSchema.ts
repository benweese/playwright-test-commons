/**
 * JSON Schema validation for API responses.
 *
 * Schemas are files named `<schemasDir>/<name>.schema.json`, where the name can include
 * folders: `"posts/getPost"` → `schemas/posts/getPost.schema.json`. `schemasDir` defaults to
 * `<cwd>/schemas`; set it once with {@link configureSchemas}.
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

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/** Compiled validators by schema name, kept for the life of the worker. */
const validators = new Map<string, ValidateFunction>();

/** Settings for {@link configureSchemas}. */
export interface SchemaSettings {
	/** Absolute path to the schemas folder. */
	schemasDir?: string;
	/** Passed to `validateDatesInBody` on every validation, e.g. a non-ISO date format. */
	dateOptions?: DateOptions;
}

/**
 * Sets where schemas live and how dates are checked. Call it once, from the test repo's config.
 * Clears the cache of compiled schemas.
 *
 * @param settings - see {@link SchemaSettings}; omitted settings keep their current value
 *
 * @example
 * configureSchemas({ schemasDir: path.join(root, "schemas") });
 */
export function configureSchemas({ schemasDir, dateOptions }: SchemaSettings = {}): void {
	if (schemasDir) {
		settings.schemasDir = schemasDir;
	}
	if (dateOptions) {
		settings.dateOptions = dateOptions;
	}
	validators.clear();
}

/** Loads and compiles a schema the first time it is used, then returns the cached validator. */
async function loadValidator(name: string): Promise<ValidateFunction> {
	let validate = validators.get(name);
	if (!validate) {
		const file = schemaFilePath(settings.schemasDir, name);
		validate = ajv.compile(JSON.parse(await readFile(file, "utf8")));
		validators.set(name, validate);
	}
	return validate;
}

/** Settings for {@link validateJsonSchema}. */
export interface ValidateOptions {
	/** Generate the schema from this body first. For new endpoints only; never commit it. Default `false`. */
	update?: boolean;
	/** Also check every date-like field. Default `true`. */
	checkDates?: boolean;
}

/**
 * Asserts (soft) that a body matches its schema, and that every date-like field holds a valid
 * date. Every mismatch is logged, not just the first.
 *
 * For a new endpoint, run once with `{ update: true }` (or `UPDATE_SCHEMAS=true` for a whole
 * run) to generate the schema from the real response. Review it, commit it, then remove the
 * flag: left on, it rewrites the schema from every response and hides real changes.
 *
 * @param name - schema name, e.g. `"posts/getPost"`
 * @param body - the parsed response body
 * @param options - see {@link ValidateOptions}
 * @throws Error if the schema file doesn't exist or can't be read
 *
 * @example
 * const body = await getBody(await Posts.list());
 * await validateJsonSchema("posts/listPosts", body);
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
	expect.soft(valid, `Response matches schema "${name}"`).toBe(true);

	if (checkDates) {
		validateDatesInBody(body, settings.dateOptions);
	}
}

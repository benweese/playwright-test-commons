/**
 * Generates JSON Schema files from real response bodies.
 *
 * @module createJsonSchema
 */

import { createSchema } from "genson-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

type SchemaNode = Record<string, unknown>;

function isNode(value: unknown): value is SchemaNode {
	return value !== null && typeof value === "object";
}

/**
 * Resolves the file for a schema name. The name comes from test code but still becomes a file
 * path, so it is sanitized: `..` is removed and characters other than letters, digits, `/`,
 * `_` and `-` become `_`.
 *
 * @param schemasDir - the schemas folder
 * @param name - schema name, e.g. `"posts/getPost"`
 * @returns the absolute path, e.g. `<schemasDir>/posts/getPost.schema.json`
 * @throws Error if the name resolves outside `schemasDir`
 */
export function schemaFilePath(schemasDir: string, name: string): string {
	const safe = name.replace(/\.\./g, "").replace(/[^a-zA-Z0-9/_-]/g, "_");
	const file = path.resolve(schemasDir, `${safe}.schema.json`);
	const root = path.resolve(schemasDir);
	if (!file.startsWith(root + path.sep)) {
		throw new Error(`Schema name "${name}" resolves outside ${root}`);
	}
	return file;
}

/** One sample can't show a null field's real type, so allow null or a string. */
function nullToNullableString(node: unknown): void {
	if (isNode(node)) {
		if (node.type === "null") {
			node.type = ["null", "string"];
		}
		Object.values(node).forEach(nullToNullableString);
	}
}

/** Sets `additionalProperties: false` on every object, so new or renamed fields fail validation. */
function closeObjects(node: unknown): void {
	if (isNode(node)) {
		if (node.type === "object") {
			node.additionalProperties = false;
		}
		Object.values(node).forEach(closeObjects);
	}
}

/**
 * Writes a strict JSON Schema (draft-07) inferred from a response body. Every object gets
 * `additionalProperties: false`, and fields that were null become `["null", "string"]`.
 * Review the file and tighten it by hand (required fields, enums, formats) before committing.
 *
 * Usually called through `validateJsonSchema(name, body, { update: true })` or
 * `UPDATE_SCHEMAS=true`, not directly.
 *
 * @param schemasDir - the schemas folder
 * @param name - schema name, e.g. `"posts/getPost"`
 * @param body - a real response body to infer the schema from
 * @throws Error if the name resolves outside `schemasDir`
 */
export async function createJsonSchema(schemasDir: string, name: string, body: unknown): Promise<void> {
	const file = schemaFilePath(schemasDir, name);
	const schema = structuredClone(createSchema(body)) as SchemaNode;
	nullToNullableString(schema);
	closeObjects(schema);
	schema.$schema = "http://json-schema.org/draft-07/schema#";
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `${JSON.stringify(schema, null, "\t")}\n`, "utf8");
	console.log(`Wrote schema ${path.relative(process.cwd(), file)}. Review it before committing.`);
}

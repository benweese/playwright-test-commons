/**
 * Generates a JSON Schema file from a real response body.
 *
 * The generated schema is strict on purpose: every object gets additionalProperties: false,
 * so a new or renamed field fails the test until the schema is reviewed. Fields that were
 * null in the sample become ["null", "string"], since one sample can't show the real type.
 * Review and tighten generated schemas by hand (enums, formats, required fields).
 *
 * @module createJsonSchema
 */

import { createSchema } from "genson-js";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

/**
 * Resolves the file for a schema name, refusing anything that escapes the schemas folder.
 * The name comes from test code, but it still builds a filesystem path, so it's sanitized.
 *
 * @param {string} schemasDir
 * @param {string} name - e.g. "posts/getPost"
 */
export function schemaFilePath(schemasDir, name) {
	const safe = String(name)
		.replace(/\.\./g, "")
		.replace(/[^a-zA-Z0-9/_-]/g, "_");
	const file = path.resolve(schemasDir, `${safe}.schema.json`);
	const root = path.resolve(schemasDir);
	if (!file.startsWith(root + path.sep)) {
		throw new Error(`Schema name "${name}" resolves outside ${root}`);
	}
	return file;
}

function nullToNullableString(node) {
	if (node && typeof node === "object") {
		if (node.type === "null") {
			node.type = ["null", "string"];
		}
		Object.values(node).forEach(nullToNullableString);
	}
	return node;
}

function closeObjects(node) {
	if (node && typeof node === "object") {
		if (node.type === "object") {
			node.additionalProperties = false;
		}
		Object.values(node).forEach(closeObjects);
	}
	return node;
}

/**
 * @param {string} schemasDir
 * @param {string} name
 * @param {unknown} body
 */
export async function createJsonSchema(schemasDir, name, body) {
	const file = schemaFilePath(schemasDir, name);
	const schema = closeObjects(nullToNullableString(structuredClone(createSchema(body))));
	schema.$schema = "http://json-schema.org/draft-07/schema#";
	await mkdir(path.dirname(file), { recursive: true });
	await writeFile(file, `${JSON.stringify(schema, null, "\t")}\n`, "utf8");
	console.log(`Wrote schema ${path.relative(process.cwd(), file)}. Review it before committing.`);
}

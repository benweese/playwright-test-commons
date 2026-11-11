import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import jsdoc from "eslint-plugin-jsdoc";
import prettier from "eslint-config-prettier";

export default tseslint.config(
	{ ignores: ["**/node_modules/**", "dist/**", "**/test-results/**", "**/playwright-report/**", ".tmp/**"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: { ...globals.node }
		},
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/consistent-type-imports": "error",
			"prefer-const": "error",
			"no-var": "error",
			eqeqeq: ["error", "always"]
		}
	},
	{
		files: ["src/**/*.ts"],
		plugins: { jsdoc },
		settings: { jsdoc: { mode: "typescript" } },
		rules: {
			// Every exported function, class and method is documented, and its tags stay accurate.
			"jsdoc/require-jsdoc": [
				"error",
				{
					publicOnly: true,
					require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: true }
				}
			],
			"jsdoc/check-param-names": ["error", { checkDestructured: false }],
			"jsdoc/check-tag-names": ["error", { definedTags: ["module"] }],
			"jsdoc/no-types": "error",
			"jsdoc/require-returns-check": "error"
		}
	},
	prettier
);

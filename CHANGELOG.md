# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Before 1.0.0, a minor version may
include breaking changes; they are listed under **Breaking**.

Test repos install a tag: `npm install github:benweese/playwright-test-commons#v0.8.0`.

## [Unreleased]

## [0.8.0] - 2026-11-12

### Added

- Unit tests for every export, including failure paths whose messages are checked in a separate
  Playwright run, and an end-to-end test of the `check-test-ids` command.
- Coverage report in CI (c8), shown in the job summary.
- API documentation generated with TypeDoc and published to GitHub Pages.
- Release workflow: a `v*` tag runs CI and creates a GitHub release from this changelog. The
  API docs are published from `main`.

### Changed

- `validateJsonSchema` failures list every mismatch, one line each, instead of
  `expected true, received false`: `body[0].price: must be number, got "12.50"`,
  `body: unexpected field "extra"`, `body: missing field "id"`. The raw ajv errors are no longer
  printed to stderr. What passes and what fails is unchanged.

### Fixed

- `BasePage.clickAndHandleDialog` JSDoc said it gives up after the action timeout; with no
  `actionTimeout` set it waits for the test timeout.
- The `options` descriptions of `errorCheck` and `expectSortedByDate` were missing from the
  generated docs.

### Security

- Override `glob` to 14.x to fix
  [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) in c8's dependencies
  (dev tooling only).

## [0.7.0] - 2026-11-12

### Added

- `BasePage`: `expectCount`, `expectAny`, `expectValue`, `expectInvalid` (browser validation),
  `expectFilesAttached`, `expectTitle`, `reload`, `waitForLoad`, `clickAndWaitForResponse`,
  `uploadFiles`, `clickAndHandleDialog` and `recordDialogs`. `ExpectOptions` takes a `timeout`.
- `expectNoA11yViolations`, `scanA11y` and `WCAG_AA_TAGS`: axe-core scans, WCAG 2.0–2.2 A and AA
  by default. `@axe-core/playwright` is an optional peer dependency, loaded only when a scan runs.
- `uniqueEmail` for test data on a domain the test repo controls.

## [0.6.0] - 2026-11-10

### Added

- `check-test-ids` command: fails on a test with no id, an id used twice anywhere in the repo,
  or a test that no Playwright project runs.
- README: requirements, usage per helper, every export, source layout and release steps.

## [0.5.1] - 2026-11-10

### Changed

- JSDoc on every export, enforced by `eslint-plugin-jsdoc`. Compiled JavaScript is unchanged.

### Security

- Override `minimatch` to 11.x to fix
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) in dev tooling.

## [0.5.0] - 2026-11-10

### Changed

- **Breaking:** `timingCheck(call, maxAverageMs, { runs, warmup })` measures with Playwright's
  `response.timing()`, from request sent to last byte, so DNS, TCP and TLS setup never count.
  It skips one warm-up call by default, reports time to first byte and returns the numbers.

## [0.4.0] - 2026-11-10

### Added

- Typed responses: `ApiBase.get/post/put/patch/delete/send<T>` return `APIResponse<T>`, and
  `getBody` and `pollUntil` infer the body type from it.

### Removed

- **Breaking:** `createConfig` and the environment types. Test repos keep their own settings.

### Changed

- **Breaking:** peer dependency is `@playwright/test` >= 1.65.
- CI uses actions v7 with read-only permissions; Dependabot opens weekly updates.

## [0.3.0] - 2026-11-10

### Changed

- Rewritten in TypeScript (strict, NodeNext). The package ships compiled JavaScript, type
  definitions and source.
- Installed from the git tag: npm builds `dist/` through the `prepare` script.

## [0.2.0] - 2026-11-10

### Changed

- **Breaking:** `generateTestDescription` takes a positive whole-number id, shown as `#0012`;
  string ids such as `"SMOKE-001"` are rejected. Kinds of test come from tags, not id prefixes.

### Added

- `formatTestId`.

## [0.1.0] - 2026-11-08

### Added

- `ApiBase` (JSON or form bodies, one reused request context, per-request headers), `getBody`,
  `errorCheck`, `timingCheck` and `pollUntil`.
- Strict JSON schema generation and validation with automatic date checks.
- `BasePage`, whose `goto` waits for `domcontentloaded`.
- `createConfig`, `generateTestDescription` and `TAGS`.

[Unreleased]: https://github.com/benweese/playwright-test-commons/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/benweese/playwright-test-commons/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/benweese/playwright-test-commons/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/benweese/playwright-test-commons/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/benweese/playwright-test-commons/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/benweese/playwright-test-commons/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/benweese/playwright-test-commons/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/benweese/playwright-test-commons/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/benweese/playwright-test-commons/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/benweese/playwright-test-commons/releases/tag/v0.1.0

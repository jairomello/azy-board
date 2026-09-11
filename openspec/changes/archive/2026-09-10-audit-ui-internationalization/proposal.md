## Why

The application exposes PT-BR text in multiple interface areas after the user selects English, as shown on the Projects page. This creates an inconsistent experience and indicates that parts of the UI bypass the existing i18n system. A systematic review is needed before applying isolated translations so all screens, states, and locale-sensitive values follow the same contract.

## What Changes

- Audit the complete web interface for visible hardcoded text, incomplete translation keys, incorrect namespaces, and missing locale coverage.
- Replace UI text that bypasses i18n with translation keys in the appropriate feature namespace.
- Complete PT-BR, EN, and ES translation resources for all audited interface areas, including navigation, project management, board, dashboard, account, settings, dialogs, empty states, errors, notifications, and the Azy Agent.
- Review locale-sensitive date, time, number, relative-time, and pluralized messages.
- Add automated checks and representative UI tests that detect missing keys and verify language switching without a page reload.
- Preserve user language selection and the existing PT-BR fallback behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `i18n`: Require complete translation coverage for visible UI states and consistent use of locale-aware formatting across the web application.

## Impact

- Frontend React components and shared UI primitives under `apps/web/src/`.
- i18next/react-i18next configuration and translation resources under `apps/web/src/i18n/`.
- Existing i18n specification and frontend test suites.
- No API or database contract changes are expected.

/**
 * Public entry point of `@grimora/ui` — the shared presentation-components package (ADR 0003 module map).
 *
 * Consumers (`apps/web` now; Tauri/Expo later) import components only from here, never via deep paths
 * (the ADR 0003 §2.6 no-deep-import boundary). Near-empty for the scaffold (#105-A); grows as the
 * character-sheet and later surfaces are built.
 */
export { AppShell, type AppShellProps } from './app-shell';

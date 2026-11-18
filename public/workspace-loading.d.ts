export function syncWorkspaceSpinner(loader: HTMLElement): void;
export function prepareWorkspaceLoadingExit(loader: HTMLElement | null): (() => void) | undefined;
export function hideWorkspaceLoading(target: HTMLElement): void;
export function showWorkspaceLoading(target: HTMLElement, title?: string): void;

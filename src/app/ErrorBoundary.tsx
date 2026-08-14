import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * The missing half of the boot watchdog (issue #71).
 *
 * `index.html`'s watchdog refuses to repaint once React has mounted, and that rule is
 * right: a stray rejection at hour three must not wipe an inspector's work. But it guards
 * against the WATCHDOG destroying the screen — and in #71 the screen was already gone,
 * because React unmounts the entire root when a render throws with no boundary above it.
 * The app was protected from the one thing that was never going to happen and not from the
 * one that did, so every post-boot render failure arrived as a black rectangle carrying no
 * text anywhere in the app.
 *
 * This is that same rule applied one layer in: catch the throw where React would otherwise
 * discard the tree, and render what failed. Nothing here writes to storage — the session's
 * events are already durable, and recovery is a navigation, not a repair.
 *
 * ⚑ The audience is a concierge holding an iPad in someone's basement, so the panel has to
 * be screenshot-able and readable: selectable text, the message first, the stack below it,
 * and a way back that does not cost the visit. "Send this screenshot" is the whole support
 * protocol, and #71's history is that the evidence was destroyed before anyone saw it.
 */

interface Props {
  children: ReactNode;
  /**
   * What surrounds the failure — screen name, session id, config version. Read lazily and
   * inside a try, because a boundary that throws while describing a throw reports nothing.
   */
  context?: () => Record<string, unknown>;
  /**
   * Recovery that keeps the visit: drop back to a known-good screen without touching data.
   * Absent on the outermost boundary, where there is nowhere safer to go than a reload.
   */
  onRecover?: () => void;
  recoverLabel?: string;
  /** Changing this re-arms the boundary — a new screen deserves a fresh attempt. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: "" };
  private armedFor?: string;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? "" });
    // Also log it: the device console is attachable over the cable (Safari Web Inspector,
    // enabled in release by capacitor.config.ts), and that is how this gets read remotely.
    console.error("[hs] render failure caught by ErrorBoundary:", error, info.componentStack);
  }

  componentDidUpdate() {
    // Re-arm on navigation. Guarded on a stored key rather than compared in render, so a
    // boundary that fails repeatedly on the same screen stays failed instead of looping.
    if (this.state.error && this.props.resetKey !== undefined && this.armedFor !== this.props.resetKey) {
      this.armedFor = this.props.resetKey;
      this.setState({ error: null, componentStack: "" });
    }
  }

  private describe(): string {
    try {
      return JSON.stringify(this.props.context?.() ?? {}, null, 2);
    } catch (err) {
      return `context unavailable: ${String(err)}`;
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { onRecover, recoverLabel = "Back to the home screen" } = this.props;
    const detail = [
      error.stack ?? `${error.name}: ${error.message}`,
      this.state.componentStack && `--- component stack ---${this.state.componentStack}`,
      `--- app state ---\n${this.describe()}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    return (
      <div className="min-h-dvh select-text overflow-auto bg-slate-950 p-6 text-slate-100">
        <h1 className="mb-2 text-base font-semibold text-red-400">Something on this screen failed</h1>
        <p className="mb-3 text-sm text-slate-400">
          Your inspection is still saved on this device — nothing was lost. Screenshot this and send
          it, then carry on.
        </p>
        <p className="mb-4 rounded-lg bg-slate-900 p-3 font-mono text-sm text-slate-200">
          {error.message || String(error)}
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          {onRecover && (
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null, componentStack: "" });
                onRecover();
              }}
              className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white active:bg-teal-700"
            >
              {recoverLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-slate-600 active:bg-slate-700"
          >
            Restart the app
          </button>
        </div>
        <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-3 text-xs text-slate-400">
          {detail}
        </pre>
      </div>
    );
  }
}

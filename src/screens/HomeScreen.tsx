import { useState } from "react";
import { useApp } from "../store/sessionStore";
import { BigButton, formatBytes } from "../ui/bits";

export function HomeScreen() {
  const { sessionRows, route, routeErrors, storage, navigate, resumeSession, abandonSession, showToast } = useApp();
  const [resuming, setResuming] = useState(false);
  const tryResume = (id: string) => {
    if (resuming) return;
    setResuming(true);
    resumeSession(id)
      .catch((err) => showToast(err instanceof Error ? err.message : "Could not open this session"))
      .finally(() => setResuming(false));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-3xl font-bold text-slate-100">HouseSteady Field Assistant</h1>
        <p className="mt-1 text-slate-400">
          {route ? `${route.title} — config v${route.configVersion}` : "Route config failed validation"}
        </p>
      </header>

      {routeErrors.length > 0 && (
        <div className="rounded-xl border border-rose-500 bg-rose-950/50 p-4 text-rose-200">
          <p className="font-semibold">The route config is invalid — sessions can't start until it's fixed:</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {routeErrors.map((e, i) => (<li key={i}>{e}</li>))}
          </ul>
        </div>
      )}

      <BigButton disabled={!route} onClick={() => navigate({ name: "setup" })}>
        Start new inspection
      </BigButton>

      {sessionRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-300">Sessions</h2>
          {sessionRows.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-slate-800 p-4">
              <div className="flex-1">
                <p className="font-medium text-slate-100">{s.propertyLabel || s.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-400">
                  {new Date(s.createdAt).toLocaleString()} · {s.status} · config v{s.configVersion}
                </p>
              </div>
              {(s.status === "active" || s.status === "completed") && (
                <BigButton variant="secondary" disabled={resuming} onClick={() => tryResume(s.id)}>
                  {s.status === "active" ? "Resume" : "Open"}
                </BigButton>
              )}
              {s.status === "active" && (
                <BigButton
                  variant="ghost"
                  onClick={() => { if (confirm("Abandon this session? Its data stays on device but it leaves the active list.")) void abandonSession(s.id); }}
                >
                  Abandon
                </BigButton>
              )}
            </div>
          ))}
        </section>
      )}

      <footer className="mt-4 text-sm text-slate-500">
        {storage && (
          <p>
            Storage: {storage.usage !== undefined ? formatBytes(storage.usage) : "?"} used
            {storage.quota !== undefined ? ` of ${formatBytes(storage.quota)}` : ""} ·{" "}
            {storage.persisted ? "persistent" : "NOT persistent — install to home screen"}
          </p>
        )}
        <p className="mt-1">Offline-first: nothing here ever waits on a network.</p>
      </footer>
    </div>
  );
}

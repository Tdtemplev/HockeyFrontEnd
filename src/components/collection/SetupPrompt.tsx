export function SetupPrompt() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-300">
        Setup required
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">
        Connect your Slab API key
      </h2>
      <p className="mt-3 text-slate-300">
        Mint a key at{" "}
        <a
          href="https://app.slab.dev-jeb.com"
          className="text-sky-400 underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          app.slab.dev-jeb.com
        </a>{" "}
        and add it to <code className="rounded bg-slate-950 px-1.5 py-0.5 text-sm">.env.local</code>.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-xl bg-slate-950 p-4 text-left text-sm text-slate-300">
{`SLAB_API_KEY=sk_live_...
# optional — auto-detected from /account if omitted
# SLAB_COLLECTOR_UUID=`}
      </pre>
    </div>
  );
}

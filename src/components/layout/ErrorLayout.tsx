import { useRouteError } from "react-router-dom";
import { TitleBar } from "@/components/layout/TitleBar";

export function ErrorLayout() {
  const error = useRouteError();

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0a] text-text">
      <div className="flex h-full flex-col">
        <TitleBar />
        <div className="flex min-h-0 flex-1 items-center justify-center px-4">
          <div className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0d0d0d] p-8 text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="mb-2 text-lg font-semibold text-text">Something went wrong</h1>
            <p className="mb-6 text-sm leading-5 text-textMuted">
              {error instanceof Error ? error.message : "An unexpected error occurred."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                onClick={() => window.location.reload()}
              >
                Reload App
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium transition-all hover:bg-muted"
                onClick={() => window.history.back()}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

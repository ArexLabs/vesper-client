import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function ErrorPage() {
  const error = useRouteError();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col items-center justify-center px-4 py-20">
      <div className="w-full max-w-[440px] rounded-3xl border border-white/10 bg-[#0d0d0d] p-8 text-center">
        <div className="mb-4 text-5xl">⚠️</div>
        <h1 className="mb-2 text-lg font-semibold text-text">Something went wrong</h1>
        <p className="mb-6 text-sm leading-5 text-textMuted">
          {error instanceof Error ? error.message : "An unexpected error occurred."}
        </p>
        <div className="flex gap-3 justify-center">
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload App
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

// Fallback error page in case the main one fails
export function DefaultErrorPage() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0a0a0a',
      color: '#fafafa',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>Something went wrong</h1>
        <p style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '24px' }}>
          An unexpected error occurred.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffcea7',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Reload App
        </button>
      </div>
    </div>
  );
}


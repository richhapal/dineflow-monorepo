'use client';

interface Props {
  reason?: string | null;
  pauseUntil?: string | null;
  restaurantName?: string;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

export default function OrderingPausedScreen({ reason, pauseUntil, restaurantName }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm w-full">
        {/* Icon */}
        <div className="text-5xl mb-5">⏸️</div>

        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Ordering paused
        </h1>

        {restaurantName && (
          <p className="text-sm text-muted-foreground mb-4">{restaurantName}</p>
        )}

        {reason ? (
          <p className="text-sm text-foreground/80 bg-muted rounded-lg px-4 py-3 mb-4">
            {reason}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">
            The kitchen has temporarily paused new orders. Please check back in a moment.
          </p>
        )}

        {pauseUntil && (
          <p className="text-xs text-muted-foreground">
            Expected to resume at <span className="font-medium">{formatTime(pauseUntil)}</span>
          </p>
        )}

        {/* Subtle pulsing indicator */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Waiting for kitchen…</span>
        </div>
      </div>
    </div>
  );
}

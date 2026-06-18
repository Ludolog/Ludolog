import { AlertCircle, Loader2, WifiOff } from "lucide-react";

export function LoadingState({ label = "Ładowanie danych" }: { label?: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-5 text-center text-sm text-slate-300">
      <Loader2 size={22} className="mx-auto mb-3 animate-spin text-radar-cyan" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry
}: {
  message: string;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <div className="surface rounded-lg p-5 text-center">
      <WifiOff size={24} className="mx-auto mb-3 text-radar-red" />
      <p className="text-sm font-semibold text-white">Problem z połączeniem</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-11 rounded-md bg-radar-cyan px-4 text-sm font-semibold text-slate-950"
        >
          Spróbuj ponownie
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <div className="surface rounded-lg p-5 text-center text-sm text-slate-400">
      <AlertCircle size={22} className="mx-auto mb-3 text-radar-amber" />
      {message}
    </div>
  );
}

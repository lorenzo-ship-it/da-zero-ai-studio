import { Component, ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 p-4 text-sm text-rose-100">
          <p className="font-semibold">Si è verificato un errore imprevisto.</p>
          <p className="mt-1 text-rose-200">
            {this.state.error?.message ?? "Riprova più tardi."}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

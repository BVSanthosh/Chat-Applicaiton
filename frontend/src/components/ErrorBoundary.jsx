import { Component } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Without this, any render-time exception unmounts the whole tree and leaves a
 * blank white page with nothing in the UI to explain it.
 */
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled render error", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-base-200">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <div className="size-14 rounded-2xl bg-error/10 flex items-center justify-center">
              <AlertTriangle className="size-7 text-error" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-base-content/60">
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload Chatcast
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;

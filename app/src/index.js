import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("React render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <h1>Something broke</h1>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error && this.state.error.message
              ? this.state.error.message
              : this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById("root");
if (!container) {
  document.body.innerHTML =
    '<p style="padding:16px;font-family:system-ui">Missing #root in index.html</p>';
} else {
  const root = createRoot(container);
  root.render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>,
  );
}

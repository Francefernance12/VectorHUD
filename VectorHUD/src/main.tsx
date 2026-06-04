import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { logger } from "./utils/logger";

window.onerror = (msg, src, line, col, err) => {
  logger.error(`Global Error: ${msg} at ${src}:${line}:${col} \n ${err?.stack}`);
};
window.onunhandledrejection = (e) => {
  logger.error(`Unhandled Rejection: ${e.reason}`);
};

// Attempt to flush any lingering crash logs before the React tree mounts
logger.flushCrashBacklog();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

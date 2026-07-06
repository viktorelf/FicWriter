import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./App.css";
import { error, info, warn, trace } from "@tauri-apps/plugin-log";

function setupErrorLogging() {
  if (!(window as any).__TAURI__) return;
  const baseConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args) => {
    baseConsole.log(...args);
    trace(args.map(String).join(" "));
  };
  console.info = (...args) => {
    baseConsole.info(...args);
    info(args.map(String).join(" "));
  };
  console.warn = (...args) => {
    baseConsole.warn(...args);
    warn(args.map(String).join(" "));
  };
  console.error = (...args) => {
    baseConsole.error(...args);
    error(args.map(String).join(" "));
  };

  window.addEventListener("error", (event) => {
    const msg = event.error?.stack ?? event.message ?? "Unknown error";
    error(`window.error: ${msg}`);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = (event.reason && (event.reason.stack || event.reason.message)) ?? event.reason;
    error(`unhandledrejection: ${String(reason ?? "Unknown reason")}`);
  });
}

setupErrorLogging();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

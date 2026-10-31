import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/jetbrains-mono";
import "@xterm/xterm/css/xterm.css";
import App from "./App";
import { FONT_FAMILY } from "./theme";

// xterm measures the character size once when a terminal opens, so the font has to be
// loaded first or every terminal would be laid out with the fallback font's metrics
document.fonts.load(`14px ${FONT_FAMILY}`).finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

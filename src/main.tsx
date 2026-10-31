import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/fira-code";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@xterm/xterm/css/xterm.css";
import App from "./App";
import { applyUiTheme, fontById, themeById } from "./theme";
import { loadSettings } from "./settings";

// paint the saved theme right away, so there's no flash of the default colors
const settings = loadSettings();
applyUiTheme(themeById(settings.theme));

// xterm measures the character size once when a terminal opens, so the font has to be
// loaded first or every terminal would be laid out with the fallback font's metrics
document.fonts.load(`${settings.terminalFontSize}px ${fontById(settings.font).family}`).finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});

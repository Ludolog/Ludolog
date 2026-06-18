import React from "react";
import ReactDOM from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

import { App } from "@/App";
import "@/styles.css";

void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
void StatusBar.setBackgroundColor({ color: "#070A12" }).catch(() => undefined);
void SplashScreen.hide().catch(() => undefined);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

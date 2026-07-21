import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./phase2.css";
import "./phase5.css";
import "./phase3.css";
import "./phase4.css";
import "./ui-refresh.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

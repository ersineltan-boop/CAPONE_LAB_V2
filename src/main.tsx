import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import TeamAccountProvider from "./team/TeamAccountProvider";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TeamAccountProvider>
      <App />
    </TeamAccountProvider>
  </StrictMode>,
);

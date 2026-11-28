import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import TeamAccountProvider from "./team/TeamAccountProvider";
import { TeamMemberEntry } from "./team/TeamMemberEntry";
import "./index.css";

const App = lazy(() => import("./App"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TeamAccountProvider>
      <TeamMemberEntry>
        <Suspense fallback={<p role="status" className="p-8 text-center text-sm text-ink-muted">CAPONE LAB yükleniyor…</p>}>
          <App />
        </Suspense>
      </TeamMemberEntry>
    </TeamAccountProvider>
  </StrictMode>,
);

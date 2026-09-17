import { useEffect, useState } from "react";

import { getSession, subscribeSession } from "./session";
import type { AppSession } from "./roles";

export function useSession(): AppSession {
  const [session, setSession] = useState<AppSession>(() => getSession());

  useEffect(() => {
    setSession(getSession());
    return subscribeSession(() => setSession(getSession()));
  }, []);

  return session;
}

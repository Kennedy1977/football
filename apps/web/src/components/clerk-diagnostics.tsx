"use client";

import { useEffect, useMemo, useState } from "react";

function decodeFrontendApiHost(publishableKey: string): string | null {
  const tokenParts = publishableKey.split("_");
  if (tokenParts.length < 3) {
    return null;
  }

  const encoded = tokenParts.slice(2).join("_");
  if (!encoded) {
    return null;
  }

  try {
    const decoded = atob(encoded).trim();
    return decoded.endsWith("$") ? decoded.slice(0, -1) : decoded;
  } catch {
    return null;
  }
}

export function ClerkDiagnostics({ publishableKey }: { publishableKey: string }) {
  const [showPanel, setShowPanel] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);

  const frontendApiHost = useMemo(() => decodeFrontendApiHost(publishableKey), [publishableKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowPanel(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!showPanel || !frontendApiHost) {
      return;
    }

    let active = true;

    void fetch(`https://${frontendApiHost}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
      mode: "no-cors",
      cache: "no-store",
    })
      .then(() => {
        if (active) {
          setReachable(true);
        }
      })
      .catch(() => {
        if (active) {
          setReachable(false);
        }
      });

    return () => {
      active = false;
    };
  }, [frontendApiHost, showPanel]);

  if (!showPanel) {
    return null;
  }

  return (
    <div className="clerk-diagnostics">
      <p className="clerk-diagnostics-title">Clerk is taking longer than expected to load.</p>
      <p className="clerk-diagnostics-copy">Publishable key Frontend API host: {frontendApiHost || "Unable to decode"}.</p>
      {reachable === false ? (
        <p className="clerk-diagnostics-copy error">
          That host is unreachable from the browser. Add/fix Clerk custom domain DNS (CNAME) before sign-in can work.
        </p>
      ) : null}
      {reachable === true ? (
        <p className="clerk-diagnostics-copy">Host is reachable. Next check Clerk allowed redirect URLs and social provider config.</p>
      ) : null}
    </div>
  );
}

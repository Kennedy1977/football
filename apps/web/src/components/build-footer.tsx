"use client";

import { useEffect, useState } from "react";
import { APP_VERSION_LABEL } from "../lib/build-meta";

export function BuildFooter() {
  const [versionLabel, setVersionLabel] = useState<string>(APP_VERSION_LABEL);

  useEffect(() => {
    let active = true;
    const cacheBust = Date.now();

    void fetch(`/version.json?t=${cacheBust}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!active || !payload || typeof payload !== "object") {
          return;
        }

        const label =
          typeof (payload as { label?: unknown }).label === "string"
            ? String((payload as { label?: string }).label)
            : null;

        if (label && label.trim()) {
          setVersionLabel(label.trim());
          return;
        }

        const version =
          typeof (payload as { version?: unknown }).version === "string"
            ? String((payload as { version?: string }).version)
            : null;

        if (version && version.trim()) {
          setVersionLabel(`v${version.replace(/^v/i, "").trim()}`);
        }
      })
      .catch(() => {
        // Fallback to bundled APP_VERSION_LABEL.
      });

    return () => {
      active = false;
    };
  }, []);

  return <div className="build-footer">Copyright &copy;2026 Andrew Kennedy · {versionLabel}</div>;
}

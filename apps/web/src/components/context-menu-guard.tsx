"use client";

import { useEffect } from "react";

export function ContextMenuGuard() {
  useEffect(() => {
    const blockContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener("contextmenu", blockContextMenu);
    return () => {
      window.removeEventListener("contextmenu", blockContextMenu);
    };
  }, []);

  return null;
}

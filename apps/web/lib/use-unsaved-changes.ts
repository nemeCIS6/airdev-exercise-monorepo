"use client";

import { useEffect } from "react";

/** Show the browser's "unsaved changes" prompt on refresh / close when active.
 * Does NOT block in-app Next.js navigation — that needs route-level interception. */
export function useUnsavedChanges(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

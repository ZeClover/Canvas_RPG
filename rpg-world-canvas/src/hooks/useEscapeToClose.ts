import { useEffect } from "react";

/** Every dialog-backdrop/tool-backdrop panel already closes on an outside
 * click; this makes Escape do the same without requiring focus to be
 * inside the panel first. */
export function useEscapeToClose(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, enabled]);
}

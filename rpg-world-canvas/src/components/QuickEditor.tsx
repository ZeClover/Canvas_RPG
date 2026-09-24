import { useEffect, useRef, useState } from "react";
import type { WorldBounds } from "../domain/types";

interface QuickEditorProps {
  initialValue: string;
  bounds: WorldBounds;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

export function QuickEditor({ initialValue, bounds, onCommit, onCancel }: QuickEditorProps) {
  const [value, setValue] = useState(initialValue.startsWith("Novo(a) ") ? "" : initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <textarea
      ref={ref}
      className="node-editor"
      value={value}
      placeholder="Digite e pressione Enter…"
      style={{
        left: Math.max(12, bounds.x),
        top: Math.max(12, bounds.y),
        width: Math.max(220, Math.min(430, bounds.width)),
        minHeight: Math.max(78, Math.min(180, bounds.height)),
      }}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onCommit(value.trim() || "Sem título")}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onCancel(); }
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onCommit(value.trim() || "Sem título"); }
      }}
    />
  );
}

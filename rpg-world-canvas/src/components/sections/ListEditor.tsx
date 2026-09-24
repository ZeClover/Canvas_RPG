import { useState } from "react";

/** Shared comma-separated-list editor — an NPC's traits/fears/goals and a
 * settlement's needs are all "a short free-form list", edited the same way:
 * type, comma-separate, blur to commit. */
export function ListEditor({ label, value, placeholder, onChange }: { label: string; value: string[]; placeholder: string; onChange: (next: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <label className="compact-field">
      {label}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onChange(text.split(",").map((item) => item.trim()).filter(Boolean))}
      />
    </label>
  );
}

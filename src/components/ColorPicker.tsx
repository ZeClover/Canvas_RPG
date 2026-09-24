interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}

export const DEFAULT_COLOR_PRESETS = [
  "#20283a", "#8290ad", "#a78bfa", "#f0abfc", "#38bdf8", "#c084fc",
  "#fb7185", "#fbbf24", "#f43f5e", "#22d3ee", "#f97316", "#818cf8",
  "#2dd4bf", "#facc15", "#ef4444", "#60a5fa", "#94a3b8", "#34d399",
];

export function ColorPicker({ value, onChange, presets = DEFAULT_COLOR_PRESETS }: ColorPickerProps) {
  return (
    <div className="color-picker">
      <div className="color-swatches" role="group" aria-label="Cores predefinidas">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            className={color.toLowerCase() === value.toLowerCase() ? "color-swatch is-active" : "color-swatch"}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Usar a cor ${color}`}
            title={color}
          />
        ))}
      </div>
      <label className="color-custom">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Cor personalizada" />
        <span>{value}</span>
      </label>
    </div>
  );
}

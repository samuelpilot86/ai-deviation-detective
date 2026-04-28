const PARAM_LABELS: Record<string, string> = {
  temperature_c: "Temperature (°C)",
  pressure_bar:  "Pressure (bar)",
  ph:            "Acidity (pH)",
  mixing_rpm:    "Agitator speed (RPM)",
  timestamp:     "Data integrity (timestamp)",
};

export function prettyParameter(raw: string): string {
  if (!raw) return raw;
  return raw
    .split(",")
    .map(s => s.trim())
    .map(s => PARAM_LABELS[s] ?? s)
    .join(", ");
}

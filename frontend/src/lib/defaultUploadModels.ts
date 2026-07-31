/**
 * Models auto-selected when uploading one workbook.
 * Add new names here as you onboard more templates.
 */
export const DEFAULT_UPLOAD_MODEL_NAMES = [
  "SCR",
  "Info 6",
  "Info 8",
  "FS-6",
] as const;

/** Normalize for fuzzy match: "FS-6" / "FS6" / "fs 6" → "fs6" */
export function normalizeModelName(name: string): string {
  return name.toLowerCase().replace(/[\s_\-./]+/g, "");
}

const ALIASES: Record<string, string[]> = {
  scr: ["scr"],
  info6: ["info6", "information6", "info06"],
  info8: ["info8", "information8", "info08"],
  fs6: ["fs6", "fs06"],
};

function canonicalKey(name: string): string | null {
  const n = normalizeModelName(name);
  for (const [canon, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(n) || n === canon) return canon;
  }
  for (const def of DEFAULT_UPLOAD_MODEL_NAMES) {
    if (normalizeModelName(def) === n) return n;
  }
  return n || null;
}

export function pickDefaultUploadModelIds(
  models: { id: string; name: string }[]
): string[] {
  const wanted = new Set(
    DEFAULT_UPLOAD_MODEL_NAMES.map((n) => canonicalKey(n)).filter(Boolean) as string[]
  );
  const picked: string[] = [];
  const seenCanon = new Set<string>();

  for (const m of models) {
    const key = canonicalKey(m.name);
    if (!key || !wanted.has(key) || seenCanon.has(key)) continue;
    seenCanon.add(key);
    picked.push(m.id);
  }
  return picked;
}

export function isDefaultUploadModelName(name: string): boolean {
  const key = canonicalKey(name);
  if (!key) return false;
  return DEFAULT_UPLOAD_MODEL_NAMES.some((n) => canonicalKey(n) === key);
}

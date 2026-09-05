export function formatDisplayName(name) {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatFirstName(name) {
  if (!name || typeof name !== "string") return "";
  const first = name.trim().split(/\s+/)[0];
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}


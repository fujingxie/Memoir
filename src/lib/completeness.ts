import type { ArchiveState, Project } from "./types";

export function archiveFilledCount(archive: ArchiveState): number {
  return (Object.keys(archive) as Array<keyof ArchiveState>).filter((key) => archive[key].filled).length;
}

export function archiveCompleteness(archive: ArchiveState): number {
  return archiveFilledCount(archive) * 25;
}

export function computeCompleteness(project: Project, archiveState: ArchiveState): number {
  const score = archiveCompleteness(archiveState);
  if (score === 0 && typeof project.archiveCompleteness === "number") {
    return Math.max(0, Math.min(100, project.archiveCompleteness));
  }

  return score;
}

export function ringColor(value: number): string {
  if (value < 40) return "var(--error)";
  if (value < 70) return "var(--warning)";
  return "var(--success)";
}

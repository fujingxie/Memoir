import type { ArchiveState, Project } from "./types";

export function archiveFilledCount(archive: ArchiveState): number {
  return (Object.keys(archive) as Array<keyof ArchiveState>).filter((key) => archive[key].filled).length;
}

export function computeCompleteness(project: Project, archiveState: ArchiveState): number {
  const filled = archiveFilledCount(archiveState);
  const score =
    filled * 20 +
    (project.git.tracked ? 8 : 0) +
    (project.description ? 6 : 0) +
    (project.docs.length > 0 ? 4 : 0) +
    (project.commits.length > 0 ? 2 : 0);

  return Math.max(0, Math.min(100, score));
}

export function ringColor(value: number): string {
  if (value < 40) return "var(--error)";
  if (value < 70) return "var(--warning)";
  return "var(--success)";
}

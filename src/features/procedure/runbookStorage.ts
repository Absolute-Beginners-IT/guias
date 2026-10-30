/** Prefix of what a runbook keeps in the browser; the planner writes under it to open a runbook already filled. */
export const runbookStorageKey = (platform: string, task: string) => `switching-manual:${platform}/${task}`

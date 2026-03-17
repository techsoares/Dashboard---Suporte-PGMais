// Shared constants — single source of truth across all views

export const PRIO_ORDER = { Highest: 0, Blocker: 0, High: 1, Medium: 2, Low: 3, Lowest: 4 }

export const issuePrio = (i) => PRIO_ORDER[i.priority?.name] ?? 2

export const WAITING_PATTERN = /aguard|wait|blocked|bloqueado|waiting/i

export const STATUS_CATEGORIES = {
  backlog: 'new',
  inProgress: 'indeterminate',
  done: 'done',
}

export function isWaiting(issue) {
  return WAITING_PATTERN.test(issue.status?.name ?? '')
}

export function isInProgress(issue) {
  return (
    issue.status?.category === STATUS_CATEGORIES.inProgress &&
    !isWaiting(issue)
  )
}

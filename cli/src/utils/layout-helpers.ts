export const MIN_COLUMN_WIDTH = 10

export const MAX_AGENT_DEPTH = 10

export const AGENT_CONTENT_HORIZONTAL_PADDING = 12

export function computeSmartColumns(itemCount: number, maxColumns: number): number {
  if (itemCount === 0) return 1
  if (itemCount <= maxColumns) return itemCount

  if (itemCount % maxColumns === 0) return maxColumns

  if (itemCount === 4 && maxColumns === 3) return 2

  for (let c = maxColumns; c >= 2; c--) {
    if (itemCount % c === 0) return c
  }

  return maxColumns
}

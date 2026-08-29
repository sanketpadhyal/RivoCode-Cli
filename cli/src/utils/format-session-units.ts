export const formatSessionUnits = (units: number): string =>
  Number.isInteger(units) ? String(units) : units.toFixed(1)

export function formatTimeout(timeoutSeconds: number): string {
  if (!Number.isFinite(timeoutSeconds)) {
    return 'no timeout'
  }
  if (timeoutSeconds < 0) {
    return 'no timeout'
  }
  const rounded = Math.round(timeoutSeconds)
  if (rounded >= 3600 && rounded % 3600 === 0) {
    return `${rounded / 3600}h timeout`
  }
  if (rounded >= 60 && rounded % 60 === 0) {
    return `${rounded / 60}m timeout`
  }
  return `${rounded}s timeout`
}

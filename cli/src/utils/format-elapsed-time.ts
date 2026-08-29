export const formatElapsedTime = (elapsedSeconds: number): string => {
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`
  }

  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  if (hours > 0) {
    return `${hours}h` + (minutes > 0 ? ` ${minutes}m` : '')
  }

  return `${minutes}m` + (seconds > 0 ? ` ${seconds}s` : '')
}

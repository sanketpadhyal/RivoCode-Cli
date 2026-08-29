export const yieldToEventLoop = (): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

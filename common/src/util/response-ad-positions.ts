
export const RESPONSE_AD_FIRST_NODE_COUNT = 2

export const RESPONSE_AD_NODE_STEP = 3

export function responseAdSlotCount(params: {
  nodeCount: number
  step?: number
  firstAdAfterNodes?: number
}): number {
  const step = Math.max(1, params.step ?? RESPONSE_AD_NODE_STEP)
  const firstAdAfterNodes = Math.max(
    1,
    params.firstAdAfterNodes ?? RESPONSE_AD_FIRST_NODE_COUNT,
  )
  return Math.max(
    0,
    Math.floor((params.nodeCount - firstAdAfterNodes - 1) / step) + 1,
  )
}

export function responseAdNodePositions(params: {
  nodeCount: number
  adCount: number
  step?: number
  firstAdAfterNodes?: number
}): number[] {
  const { nodeCount, adCount } = params
  const step = Math.max(1, params.step ?? RESPONSE_AD_NODE_STEP)
  const firstAdAfterNodes = Math.max(
    1,
    params.firstAdAfterNodes ?? RESPONSE_AD_FIRST_NODE_COUNT,
  )
  const positions: number[] = []
  const eligibleCount = Math.min(
    Math.max(0, adCount),
    responseAdSlotCount({ nodeCount, step, firstAdAfterNodes }),
  )
  for (let k = 0; k < eligibleCount; k++) {
    positions.push(firstAdAfterNodes - 1 + k * step)
  }
  return positions
}

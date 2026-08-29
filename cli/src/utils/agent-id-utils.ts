
export function getSimpleAgentId(qualifiedId: string): string {
  return qualifiedId.split('/').pop()?.split('@')[0] ?? qualifiedId
}

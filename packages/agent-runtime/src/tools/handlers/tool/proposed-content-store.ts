
const proposedContentByRunId = new Map<
  string,
  Record<string, Promise<string | null>>
>()

export function getProposedContentForRun(
  runId: string,
): Record<string, Promise<string | null>> {
  let contentByPath = proposedContentByRunId.get(runId)
  if (!contentByPath) {
    contentByPath = {}
    proposedContentByRunId.set(runId, contentByPath)
  }
  return contentByPath
}

export function getProposedContent(
  runId: string,
  path: string,
): Promise<string | null> | undefined {
  const contentByPath = proposedContentByRunId.get(runId)
  return contentByPath?.[path]
}

export function setProposedContent(
  runId: string,
  path: string,
  content: Promise<string | null>,
): void {
  const contentByPath = getProposedContentForRun(runId)
  contentByPath[path] = content
}

export function clearProposedContentForRun(runId: string): void {
  proposedContentByRunId.delete(runId)
}

export function clearAllProposedContent(): void {
  proposedContentByRunId.clear()
}

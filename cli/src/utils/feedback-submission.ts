export interface FeedbackSubmissionResolution {
  isCurrentSubmission: boolean
  shouldSettleSubmission: boolean
}

export function resolveFeedbackSubmission(
  activeClientFeedbackId: string | null,
  submittedClientFeedbackId: string,
): FeedbackSubmissionResolution {
  const isCurrentSubmission = activeClientFeedbackId === submittedClientFeedbackId
  return {
    isCurrentSubmission,
    shouldSettleSubmission: isCurrentSubmission || activeClientFeedbackId === null,
  }
}

export function convertCreditsToUsdCents(
  credits: number,
  centsPerCredit: number,
): number {
  return Math.ceil(credits * centsPerCredit)
}

export function convertStripeGrantAmountToCredits(
  amountInCents: number,
  centsPerCredit: number,
): number {
  return Math.floor(amountInCents / centsPerCredit)
}

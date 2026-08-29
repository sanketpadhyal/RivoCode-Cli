
export type SignupBlockReason =
  | 'captcha_missing'
  | 'captcha_invalid'
  | 'recaptcha_missing'
  | 'recaptcha_invalid'
  | 'mailbox_already_registered'
  | 'privacy_egress'
  | 'untrusted_client_ip'
  | 'ip_signup_velocity'
  | 'prefix_signup_velocity'

export const SIGNUP_BLOCK_MESSAGES: Record<SignupBlockReason, string> = {
  captcha_missing:
    'Please complete the verification check on the sign-in page and try again.',
  captcha_invalid:
    'That verification check could not be confirmed. Please try again.',
  recaptcha_missing:
    'Please complete the verification check on the sign-in page and try again. If it never appeared, an ad blocker or network filter may be blocking www.google.com/recaptcha.',
  recaptcha_invalid:
    'That verification check could not be confirmed. Please try again.',
  mailbox_already_registered:
    'An account already exists for this email address. Try signing in instead.',
  privacy_egress:
    'Accounts cannot be created over a VPN, proxy, or hosting provider. Please turn it off and try again — you can turn it back on afterwards.',
  untrusted_client_ip:
    'We could not verify where this request came from. Please try again, or contact support if it keeps happening.',
  ip_signup_velocity:
    'Too many accounts have been created from this network today. Please try again tomorrow, or contact support if you are on a shared connection.',
  prefix_signup_velocity:
    'Too many accounts have been created from this network today. Please try again tomorrow, or contact support if you are on a shared connection.',
}

export function isSignupBlockReason(
  code: string | null | undefined,
): code is SignupBlockReason {
  return Boolean(code) && code! in SIGNUP_BLOCK_MESSAGES
}

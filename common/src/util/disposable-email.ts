
export type FlaggedEmailDomainKind =
  | 'disposable'
  | 'privacy_relay'
  | 'mainstream_privacy'

const DISPOSABLE_EMAIL_DOMAINS = [
  '10minutemail.com',
  'dispostable.com',
  'dropmail.me',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'grr.la',
  'guerrillamail.com',
  'guerrillamail.net',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mail.tm',
  'minuteinbox.com',
  'mintemail.com',
  'mohmal.com',
  'sharklasers.com',
  'temp-mail.org',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.dev',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'aifotoeditor.com',
  'animateany.com',
  'animatimg.com',
  'biscoito.email',
  'oldtranslator.com',
  'l0veyou.com',
  'pumpkinai.space',
  'pumpkinai.it.com',
  'azahram.com',
  'barcondi.my.id',
  'bukitsakura.com',
  'cilisung.com',
  'cindohub.com',
  'duccky.com',
  'fomolu.com',
  'gamlo.my.id',
  'gamontok.com',
  'gehil.my.id',
  'geusil.com',
  'geusil.my.id',
  'ggmul.com',
  'ghyuil.my.id',
  'gkmaill.com',
  'gmaiko.com',
  'gmbel.com',
  'gmiliu.my.id',
  'gmisol.my.id',
  'gmito.my.id',
  'gmole.xyz',
  'gmosel.com',
  'gsuel.my.id',
  'gumel.store',
  'guzeil.com',
  'gwemol.my.id',
  'hayate.us',
  'jokowi.store',
  'jujusa.my.id',
  'mikontol.online',
  'monetsssky1.com',
  'satukataku.com',
  'simosel.site',
  'wdrvk.dpdns.org',
  'wdrvks.eu.org',
  'xabree.com',
  'proxyvpn.cn',
  'impact.qd.je',
  'fincy.qd.je',
  'dhisy.com',
  'dewaa.id',
  'sendang.space',
  'yotube.id',
  'gusil.my.id',
  'gmaoiil.com',
  'duojumbo.online',
  'duojumbo.com',
  'itesun.com',
  'geusil.com',
] as const

const MAINSTREAM_PRIVACY_EMAIL_DOMAINS = [
  'proton.me',
  'protonmail.ch',
  'protonmail.com',
  'pm.me',
  'privaterelay.appleid.com',
  'duck.com',
  'mozmail.com',
  'tuta.com',
  'tuta.io',
  'tutamail.com',
  'tutanota.com',
] as const

const PRIVACY_RELAY_EMAIL_DOMAINS = [
  'passmail.net',
  'aleeas.com',
  'anonaddy.me',
  'simplelogin.com',
  'simplelogin.io',
] as const

const DISPOSABLE_SET: ReadonlySet<string> = new Set(DISPOSABLE_EMAIL_DOMAINS)
const PRIVACY_RELAY_SET: ReadonlySet<string> = new Set(
  PRIVACY_RELAY_EMAIL_DOMAINS,
)
const MAINSTREAM_PRIVACY_SET: ReadonlySet<string> = new Set(
  MAINSTREAM_PRIVACY_EMAIL_DOMAINS,
)

function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return null
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
}

function matchesSet(domain: string, set: ReadonlySet<string>): boolean {
  if (set.has(domain)) return true
  let rest = domain
  for (let dot = rest.indexOf('.'); dot >= 0; dot = rest.indexOf('.')) {
    rest = rest.slice(dot + 1)
    if (set.has(rest)) return true
  }
  return false
}

export function classifyEmailDomain(
  email: string | null | undefined,
): FlaggedEmailDomainKind | null {
  if (!email) return null
  const domain = domainOf(email)
  if (!domain) return null
  if (matchesSet(domain, DISPOSABLE_SET)) return 'disposable'
  if (matchesSet(domain, PRIVACY_RELAY_SET)) return 'privacy_relay'
  if (matchesSet(domain, MAINSTREAM_PRIVACY_SET)) return 'mainstream_privacy'
  return null
}

export function isSpendCeilingFlaggedEmailDomain(
  email: string | null | undefined,
): boolean {
  const kind = classifyEmailDomain(email)
  return kind !== null && kind !== 'mainstream_privacy'
}

import { FREEBUFF_WEB_URL_PROD } from './hosts'
import { FREEBUFF_SUBSCRIPTION_TIERS } from './freebuff-subscriptions'

export type HouseAdSurface =
  | 'waiting_room'
  | 'freebuff_web_chat'
  | 'chat_assistant'
  | 'cli_chat'

export const HOUSE_AD_DESTINATION_URL = `${FREEBUFF_WEB_URL_PROD}/plans`

const ENTRY_TIER = FREEBUFF_SUBSCRIPTION_TIERS[0]
const PRICE = `$${ENTRY_TIER?.priceUsd ?? 8}/mo`

const SESSIONS_PER_DAY = ENTRY_TIER?.dailySessions ?? 3
const SESSIONS_PER_MONTH = ENTRY_TIER?.monthlySessions ?? 50

export interface HouseAdCreative {
  title: string
  adText: string
  cta: string
  url: string
  favicon: string
  imageUrl?: string
}

export const HOUSE_AD_FAVICON_URL = `${FREEBUFF_WEB_URL_PROD}/favicon/favicon-32x32.ico`

const FAVICON = HOUSE_AD_FAVICON_URL

export const HOUSE_AD_TITLE_BUDGET = 12
export const HOUSE_AD_TEXT_BUDGET = 28

const inline = (title: string, adText: string): HouseAdCreative => ({
  title,
  adText,
  cta: 'See plans',
  url: HOUSE_AD_DESTINATION_URL,
  favicon: FAVICON,
})

export const HOUSE_AD_VARIATIONS: Readonly<
  Record<HouseAdSurface, readonly HouseAdCreative[]>
> = Object.freeze({
  cli_chat: Object.freeze([
    inline('Freebuff Pro', `${SESSIONS_PER_DAY} more a day. ${PRICE}`),
    inline('Freebuff Pro', `${SESSIONS_PER_MONTH} more a month. ${PRICE}`),
    inline('Freebuff Pro', `Every model, +${SESSIONS_PER_DAY} a day.`),
    inline('Need more?', `Pro starts at ${PRICE}.`),
  ]),
  waiting_room: Object.freeze([
    inline('Freebuff Pro', `${SESSIONS_PER_DAY} more a day. ${PRICE}`),
    inline('Out of runs?', `Pro adds ${SESSIONS_PER_DAY} a day. ${PRICE}`),
    inline('Freebuff Pro', `+${SESSIONS_PER_MONTH} a month, every model.`),
    inline('Need more?', `Pro starts at ${PRICE}.`),
  ]),
  freebuff_web_chat: Object.freeze([
    inline('Freebuff Pro', `${SESSIONS_PER_DAY} more a day. ${PRICE}`),
    inline('Freebuff Pro', `${SESSIONS_PER_MONTH} more a month. ${PRICE}`),
    inline('Freebuff Pro', `Every model, +${SESSIONS_PER_DAY} a day.`),
    inline('Need more?', `Pro starts at ${PRICE}.`),
  ]),
  chat_assistant: Object.freeze([
    inline('Freebuff Pro', `${SESSIONS_PER_DAY} more a day. ${PRICE}`),
    inline('Freebuff Pro', `${SESSIONS_PER_MONTH} more a month. ${PRICE}`),
    inline('Freebuff Pro', `Every model, +${SESSIONS_PER_DAY} a day.`),
    inline('Need more?', `Pro starts at ${PRICE}.`),
  ]),
})

export const HOUSE_AD_CREATIVES: Readonly<
  Record<HouseAdSurface, HouseAdCreative>
> = Object.freeze({
  cli_chat: HOUSE_AD_VARIATIONS.cli_chat[0]!,
  waiting_room: HOUSE_AD_VARIATIONS.waiting_room[0]!,
  freebuff_web_chat: HOUSE_AD_VARIATIONS.freebuff_web_chat[0]!,
  chat_assistant: HOUSE_AD_VARIATIONS.chat_assistant[0]!,
})

export const HOUSE_AD_DISPLAY_VARIATIONS: readonly HouseAdCreative[] =
  Object.freeze([
    {
      title: 'Freebuff Pro',
      adText: `${SESSIONS_PER_DAY} more sessions a day, on every model, from ${PRICE}.`,
      cta: 'See plans',
      url: HOUSE_AD_DESTINATION_URL,
      favicon: FAVICON,
      imageUrl: `${FREEBUFF_WEB_URL_PROD}/opengraph-image.png`,
    },
    {
      title: 'Out of sessions?',
      adText: `Freebuff Pro adds ${SESSIONS_PER_DAY} a day, from ${PRICE}.`,
      cta: 'See plans',
      url: HOUSE_AD_DESTINATION_URL,
      favicon: FAVICON,
      imageUrl: `${FREEBUFF_WEB_URL_PROD}/opengraph-image.png`,
    },
    {
      title: 'More runs, every model',
      adText: `${SESSIONS_PER_MONTH} more sessions a month, from ${PRICE}.`,
      cta: 'See plans',
      url: HOUSE_AD_DESTINATION_URL,
      favicon: FAVICON,
      imageUrl: `${FREEBUFF_WEB_URL_PROD}/opengraph-image.png`,
    },
  ])

export const HOUSE_AD_DISPLAY_CREATIVE: HouseAdCreative =
  HOUSE_AD_DISPLAY_VARIATIONS[0]!

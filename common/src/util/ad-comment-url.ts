import {
  AD_PLATFORM_HOSTS,
  type AdPlatform,
} from '../constants/ad-types'

export type CommentUrlStrength =
  | 'post_confirmed'
  | 'platform_only'

export type CommentUrlCheck =
  | { ok: true; strength: CommentUrlStrength; normalized: string }
  | { ok: false; reason: string }

function parse(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url
  } catch {
    return null
  }
}

function hostMatches(url: URL, platform: AdPlatform): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  return AD_PLATFORM_HOSTS[platform].some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  )
}

function redditIds(url: URL): { postId?: string; commentId?: string } {
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.indexOf('comments')
  if (at < 0) return {}
  return { postId: parts[at + 1], commentId: parts[at + 3] }
}

function tweetId(url: URL): string | undefined {
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.indexOf('status')
  if (at < 0) return undefined
  return parts[at + 1]?.split('?')[0]
}

function linkedinActivityId(url: URL): string | undefined {
  const decoded = decodeURIComponent(
    `${url.pathname}?${url.searchParams.toString()}`,
  )
  return (
    /urn:li:activity:(\d+)/i.exec(decoded)?.[1] ??
    /activity-(\d+)-/i.exec(decoded)?.[1]
  )
}

export function checkCommentUrl(params: {
  platform: AdPlatform
  postUrl: string
  commentUrl: string
}): CommentUrlCheck {
  const url = parse(params.commentUrl)
  if (!url) return { ok: false, reason: 'That is not a valid link.' }
  if (!hostMatches(url, params.platform)) {
    return {
      ok: false,
      reason: 'That link is not on the same platform as the post.',
    }
  }
  const post = parse(params.postUrl)
  const normalized = url.toString()

  if (params.platform === 'github') {
    return {
      ok: false,
      reason: 'GitHub stars are proved with a screenshot, not a link.',
    }
  }

  if (params.platform === 'reddit') {
    const comment = redditIds(url)
    if (!comment.postId) {
      return { ok: false, reason: 'That is not a link to a Reddit comment.' }
    }
    if (!comment.commentId) {
      return {
        ok: false,
        reason:
          'That links to the post, not to your comment. Use the comment’s permalink.',
      }
    }
    const target = post ? redditIds(post).postId : undefined
    if (target && target !== comment.postId) {
      return { ok: false, reason: 'That comment is on a different post.' }
    }
    return { ok: true, strength: 'post_confirmed', normalized }
  }

  if (params.platform === 'twitter') {
    const id = tweetId(url)
    if (!id || !/^\d+$/.test(id)) {
      return { ok: false, reason: 'That is not a link to a post or reply.' }
    }
    const target = post ? tweetId(post) : undefined
    if (target && target === id) {
      return {
        ok: false,
        reason:
          'That links to the post itself. Open your reply and copy its link.',
      }
    }
    return { ok: true, strength: 'platform_only', normalized }
  }

  const activity = linkedinActivityId(url)
  if (!activity) {
    return { ok: false, reason: 'That is not a link to a LinkedIn comment.' }
  }
  const target = post ? linkedinActivityId(post) : undefined
  if (target && target !== activity) {
    return { ok: false, reason: 'That comment is on a different post.' }
  }
  const hasCommentUrn = /commentUrn/i.test(url.search)
  if (!hasCommentUrn) {
    return {
      ok: false,
      reason:
        'That links to the post, not to your comment. Open your comment’s menu and copy its link.',
    }
  }
  return {
    ok: true,
    strength: target ? 'post_confirmed' : 'platform_only',
    normalized,
  }
}

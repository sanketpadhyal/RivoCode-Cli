import fs from 'fs'
import os from 'os'
import path from 'path'

const RIVO_BIN_DIR = path.join(os.homedir(), '.rivocode', 'bin')
const WEB_SCRIPT_PATH = path.join(RIVO_BIN_DIR, 'web.js')

export const WEB_SCRIPT_SOURCE = `// RivoCode Native Web Access & Token-Optimized Markdown Extractor
const https = require('https');
const http = require('http');

function htmlToMarkdown(html) {
  if (!html) return '';
  let text = html
    .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
    .replace(/<style\\b[^<]*(?:(?!<\\/style>)<[^<]*)*<\\/style>/gi, '')
    .replace(/<svg\\b[^<]*(?:(?!<\\/svg>)<[^<]*)*<\\/svg>/gi, '')
    .replace(/<noscript\\b[^<]*(?:(?!<\\/noscript>)<[^<]*)*<\\/noscript>/gi, '')
    .replace(/<nav\\b[^<]*(?:(?!<\\/nav>)<[^<]*)*<\\/nav>/gi, '')
    .replace(/<footer\\b[^<]*(?:(?!<\\/footer>)<[^<]*)*<\\/footer>/gi, '')
    .replace(/<header\\b[^<]*(?:(?!<\\/header>)<[^<]*)*<\\/header>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\\/h1>/gi, '\\n# $1\\n')
    .replace(/<h2[^>]*>(.*?)<\\/h2>/gi, '\\n## $1\\n')
    .replace(/<h3[^>]*>(.*?)<\\/h3>/gi, '\\n### $1\\n')
    .replace(/<h[4-6][^>]*>(.*?)<\\/h[4-6]>/gi, '\\n#### $1\\n')
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\\/code><\\/pre>/gis, '\\n\`\`\`\\n$1\\n\`\`\`\\n')
    .replace(/<code[^>]*>(.*?)<\\/code>/gi, '\`$1\`')
    .replace(/<a\\s+(?:[^>]*?\\s+)?href="([^"]*)"[^>]*>(.*?)<\\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\\/li>/gi, '\\n* $1')
    .replace(/<p[^>]*>(.*?)<\\/p>/gi, '\\n$1\\n')
    .replace(/<br\\s*\\/?>/gi, '\\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();

  return text;
}

async function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RivoCode/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain;q=0.8,*/*;q=0.7',
        },
        timeout: 12000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, targetUrl).href;
          return resolve(fetchUrl(redirectUrl));
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 500000) {
            req.destroy();
            resolve(htmlToMarkdown(data));
          }
        });
        res.on('end', () => {
          resolve(htmlToMarkdown(data));
        });
      });
      req.on('error', (err) => resolve(\`[Fetch error: \${err.message}]\`));
      req.on('timeout', () => {
        req.destroy();
        resolve('[Fetch error: Request timed out after 12s]');
      });
    } catch (e) {
      resolve(\`[URL error: \${e.message}]\`);
    }
  });
}

if (require.main === module) {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.log('Usage: node web.js <url>');
    process.exit(1);
  }
  fetchUrl(urlArg).then((res) => {
    console.log(res);
  });
}

module.exports = { htmlToMarkdown, fetchUrl };
`

export function ensureWebToolExists(): string {
  try {
    const workspaceRivoDir = path.join(process.cwd(), '.rivocode')
    if (fs.existsSync(workspaceRivoDir)) {
      fs.writeFileSync(path.join(workspaceRivoDir, 'web.js'), WEB_SCRIPT_SOURCE, 'utf-8')
    }

    if (!fs.existsSync(RIVO_BIN_DIR)) {
      fs.mkdirSync(RIVO_BIN_DIR, { recursive: true })
    }
    fs.writeFileSync(WEB_SCRIPT_PATH, WEB_SCRIPT_SOURCE, 'utf-8')
  } catch (_e) {}
  return WEB_SCRIPT_PATH
}

function decodeHtmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function cleanHtmlSnippet(html: string): string {
  if (!html) return ''
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

export function htmlToMarkdown(html: string): string {
  if (!html) return ''
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '\n#### $1\n')
      .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '\n```\n$1\n```\n')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n* $1')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

export async function searchWeb(query: string): Promise<string> {
  const trimmed = query.trim()
  if (!trimmed) return 'Please provide a search query.'

  const results: Array<{ title: string; url: string; snippet: string }> = []
  const encoded = encodeURIComponent(trimmed)

  // 1. DuckDuckGo HTML Search
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encoded}`
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const rawHtml = await res.text()
      const blocks = rawHtml.split(/<div[^>]*class="[^"]*\bresult\b[^"]*"/)
      for (const block of blocks.slice(1)) {
        if (results.length >= 8) break
        const titleMatch = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/is.exec(block)
        const snippetMatch = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>(.*?)<\/a>/is.exec(block)

        if (titleMatch) {
          let rawUrl = titleMatch[1] || ''
          const uddgMatch = /uddg=([^&"]+)/.exec(rawUrl)
          if (uddgMatch && uddgMatch[1]) {
            rawUrl = decodeURIComponent(uddgMatch[1])
          } else if (rawUrl.startsWith('//')) {
            rawUrl = `https:${rawUrl}`
          }

          const cleanTitle = cleanHtmlSnippet(titleMatch[2] || '')
          const cleanSnippet = snippetMatch ? cleanHtmlSnippet(snippetMatch[1] || '') : ''

          if (cleanTitle && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
            results.push({
              title: cleanTitle,
              url: rawUrl,
              snippet: cleanSnippet,
            })
          }
        }
      }
    }
  } catch (_e) {}

  // 2. DuckDuckGo Instant Answers API (fallback & rich answers)
  if (results.length < 3) {
    try {
      const ddgApiUrl = `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`
      const res = await fetch(ddgApiUrl, {
        headers: { 'User-Agent': 'RivoCode/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.AbstractText && json.AbstractURL) {
          results.unshift({
            title: json.Heading || trimmed,
            url: json.AbstractURL,
            snippet: json.AbstractText,
          })
        }
        if (Array.isArray(json.RelatedTopics)) {
          for (const topic of json.RelatedTopics) {
            if (results.length >= 8) break
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
                url: topic.FirstURL,
                snippet: topic.Text,
              })
            }
          }
        }
      }
    } catch (_e) {}
  }

  // 3. Wikipedia API (for general knowledge, frameworks, historical terms, people)
  if (results.length < 3) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&utf8=&format=json`
      const res = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'RivoCode/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const json = await res.json()
        const searchHits = json?.query?.search || []
        for (const hit of searchHits.slice(0, 3)) {
          if (results.length >= 8) break
          results.push({
            title: `${hit.title} - Wikipedia`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/\s+/g, '_'))}`,
            snippet: cleanHtmlSnippet(hit.snippet || ''),
          })
        }
      }
    } catch (_e) {}
  }

  if (results.length === 0) {
    return `No search results found for query: "${trimmed}".`
  }

  // Format into clean, LLM-optimized markdown
  let output = `Live Web Search Results for "${trimmed}":\n\n`
  results.forEach((r, idx) => {
    output += `${idx + 1}. **[${r.title}](${r.url})**\n`
    if (r.snippet) {
      output += `   ${r.snippet}\n`
    }
    output += '\n'
  })

  return output.trim()
}

export async function fetchWebContent(targetUrl: string): Promise<string> {
  try {
    ensureWebToolExists()
    const urlObj = new URL(targetUrl)
    const res = await fetch(urlObj.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RivoCode/1.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain;q=0.8,*/*;q=0.7',
      },
      signal: AbortSignal.timeout(12000),
    })

    const contentType = res.headers.get('content-type') || ''
    const rawText = await res.text()

    if (contentType.includes('application/json')) {
      return `\`\`\`json\n${rawText.slice(0, 20000)}\n\`\`\``
    }

    const markdown = htmlToMarkdown(rawText)
    return markdown.slice(0, 25000) || '(No readable text extracted from web page)'
  } catch (err: any) {
    return `[Failed to fetch web content from ${targetUrl}: ${err.message || String(err)}]`
  }
}

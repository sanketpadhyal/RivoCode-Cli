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

export async function fetchWebContent(targetUrl: string): Promise<string> {
  try {
    ensureWebToolExists()
    const urlObj = new URL(targetUrl)
    const res = await fetch(urlObj.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RivoCode/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,text/plain;q=0.8,*/*;q=0.7',
      },
      signal: AbortSignal.timeout(12000),
    })

    const contentType = res.headers.get('content-type') || ''
    const rawText = await res.text()

    if (contentType.includes('application/json')) {
      return `\`\`\`json\n${rawText.slice(0, 20000)}\n\`\`\``
    }

    // Convert HTML to clean token-optimized Markdown
    const markdown = rawText
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
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return markdown.slice(0, 25000) || '(No readable text extracted from web page)'
  } catch (err: any) {
    return `[Failed to fetch web content from ${targetUrl}: ${err.message || String(err)}]`
  }
}

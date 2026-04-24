const BLOG_REPO = 'kylethumm90/kylethumm';
const BLOG_LABEL = 'blog';
const SITE_URL = 'https://kylethumm.com';
const CACHE_SECONDS = 300;

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function kebabTitle(t) {
  return (t || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function excerpt(md, n) {
  const text = String(md || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > n ? text.slice(0, n) + '...' : text;
}

module.exports = async function handler(req, res) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  }

  try {
    const url =
      'https://api.github.com/repos/' + BLOG_REPO +
      '/issues?labels=' + encodeURIComponent(BLOG_LABEL) +
      '&state=open&sort=created&direction=desc&per_page=50';

    const upstream = await fetch(url, { headers });
    if (!upstream.ok) {
      res.status(502).send('upstream error ' + upstream.status);
      return;
    }
    const issues = await upstream.json();
    const posts = Array.isArray(issues) ? issues.filter((i) => !i.pull_request) : [];

    const items = posts
      .map((p) => {
        const slug = p.number + (kebabTitle(p.title) ? '-' + kebabTitle(p.title) : '');
        const link = SITE_URL + '/blog/' + slug;
        const pubDate = new Date(p.created_at).toUTCString();
        return (
          '<item>' +
          '<title>' + xmlEscape(p.title) + '</title>' +
          '<link>' + xmlEscape(link) + '</link>' +
          '<guid isPermaLink="true">' + xmlEscape(link) + '</guid>' +
          '<pubDate>' + pubDate + '</pubDate>' +
          '<description>' + xmlEscape(excerpt(p.body, 400)) + '</description>' +
          '</item>'
        );
      })
      .join('');

    const lastBuildDate = posts[0]
      ? new Date(posts[0].created_at).toUTCString()
      : new Date().toUTCString();

    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">' +
      '<channel>' +
      '<title>Kyle Thumm&apos;s Blog</title>' +
      '<link>' + SITE_URL + '/blog</link>' +
      '<atom:link href="' + SITE_URL + '/rss.xml" rel="self" type="application/rss+xml" />' +
      '<description>Occasional brain dumps on AI, home services, and whatever Kyle is building.</description>' +
      '<language>en-us</language>' +
      '<lastBuildDate>' + lastBuildDate + '</lastBuildDate>' +
      items +
      '</channel></rss>';

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader(
      'Cache-Control',
      's-maxage=' + CACHE_SECONDS + ', stale-while-revalidate=' + CACHE_SECONDS * 2
    );
    res.status(200).send(xml);
  } catch (err) {
    console.error('rss error', err);
    res.status(500).send('rss error');
  }
};

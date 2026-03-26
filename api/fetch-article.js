const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!url.includes('polialert.com')) {
    return res.status(400).json({ error: 'Only polialert.com URLs are supported' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let headline = $('h1').first().text()
      || $('meta[property="og:title"]').attr('content')
      || $('meta[name="twitter:title"]').attr('content')
      || '';

    headline = headline
      .replace(/\[Video\]/gi, '')
      .replace(/\[Photos?\]/gi, '')
      .trim();

    let imageUrl = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || '';

    if (!imageUrl) {
      $('article img, .entry-content img, .jeg_featured img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src && src.startsWith('http') && !src.includes('150x150') && !src.includes('avatar')) {
          imageUrl = src;
          return false;
        }
      });
    }

    if (!headline) {
      return res.status(422).json({ error: 'Could not extract headline from article' });
    }

    let imageBase64 = null;
    let imageMimeType = 'image/jpeg';

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://polialert.com/'
          }
        });

        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          imageMimeType = contentType.split(';')[0].trim();
          const buffer = await imgRes.buffer();
          imageBase64 = `data:${imageMimeType};base64,${buffer.toString('base64')}`;
        }
      } catch (imgErr) {
        console.error('Image fetch failed:', imgErr.message);
      }
    }

    return res.status(200).json({
      headline,
      imageUrl,
      imageBase64
    });

  } catch (err) {
    console.error('Fetch error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch article' });
  }
};

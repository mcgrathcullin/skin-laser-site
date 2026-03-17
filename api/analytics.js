const { supabase, parseBody, verifyAuth, corsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  try {
    if (req.method === 'POST') {
      return await handlePost(req, res);
    }

    if (req.method === 'GET') {
      return await handleGet(req, res);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Analytics API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handlePost(req, res) {
  const body = await parseBody(req);
  const { page, referrer, user_agent } = body;

  if (!page) {
    return res.status(400).json({ error: 'Page is required' });
  }

  const view = {
    page,
    referrer: referrer || null,
    user_agent: user_agent || req.headers['user-agent'] || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase('page_views', {
    method: 'POST',
    body: view,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    // Don't fail the user experience for analytics
    return res.status(200).json({ success: true });
  }

  res.status(201).json({ success: true });
}

async function handleGet(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  // Fetch all page views from the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString();

  const { data, error } = await supabase(
    `page_views?created_at=gte.${since}&order=created_at.desc&limit=10000`,
    { method: 'GET' }
  );

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }

  // Compute summary on the server side
  const views = data || [];
  const totalViews = views.length;

  // Views by page
  const byPage = {};
  views.forEach(v => {
    byPage[v.page] = (byPage[v.page] || 0) + 1;
  });

  // Views by day
  const byDay = {};
  views.forEach(v => {
    const day = v.created_at.split('T')[0];
    byDay[day] = (byDay[day] || 0) + 1;
  });

  // Top referrers
  const byReferrer = {};
  views.forEach(v => {
    if (v.referrer) {
      byReferrer[v.referrer] = (byReferrer[v.referrer] || 0) + 1;
    }
  });

  // Sort pages by count
  const topPages = Object.entries(byPage)
    .sort((a, b) => b[1] - a[1])
    .map(([page, count]) => ({ page, count }));

  // Sort referrers by count
  const topReferrers = Object.entries(byReferrer)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([referrer, count]) => ({ referrer, count }));

  // Sort days chronologically
  const dailyViews = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  res.status(200).json({
    total_views: totalViews,
    period: '30 days',
    top_pages: topPages,
    top_referrers: topReferrers,
    daily_views: dailyViews,
  });
}

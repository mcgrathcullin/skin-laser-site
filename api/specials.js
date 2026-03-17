const { supabase, parseBody, verifyAuth, corsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res);
      case 'POST':
        return await handlePost(req, res);
      case 'PUT':
        return await handlePut(req, res);
      case 'DELETE':
        return await handleDelete(req, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Specials API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleGet(req, res) {
  // Public endpoint, no auth needed
  const { data, error } = await supabase('specials?active=eq.true&order=sort_order.asc', {
    method: 'GET',
  });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch specials' });
  }

  res.status(200).json(data);
}

async function handlePost(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const body = await parseBody(req);
  const { title, description, price, original_price, tag, active, sort_order } = body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const special = {
    title,
    description: description || null,
    price: price || null,
    original_price: original_price || null,
    tag: tag || null,
    active: active !== undefined ? active : true,
    sort_order: sort_order || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase('specials', {
    method: 'POST',
    body: special,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to create special' });
  }

  res.status(201).json(data);
}

async function handlePut(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const body = await parseBody(req);
  const { id, ...updates } = body;

  if (!id) {
    return res.status(400).json({ error: 'Special ID is required' });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase(`specials?id=eq.${id}`, {
    method: 'PATCH',
    body: updates,
  });

  if (error) {
    console.error('Supabase update error:', error);
    return res.status(500).json({ error: 'Failed to update special' });
  }

  res.status(200).json(data);
}

async function handleDelete(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const body = await parseBody(req);
  const { id } = body;

  if (!id) {
    return res.status(400).json({ error: 'Special ID is required' });
  }

  const { data, error } = await supabase(`specials?id=eq.${id}`, {
    method: 'DELETE',
  });

  if (error) {
    console.error('Supabase delete error:', error);
    return res.status(500).json({ error: 'Failed to delete special' });
  }

  res.status(200).json({ success: true });
}

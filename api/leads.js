const { supabase, sendEmail, parseBody, verifyAuth, corsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  // Handle CORS preflight
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
    console.error('Leads API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

async function handlePost(req, res) {
  const body = await parseBody(req);
  const { first_name, last_name, email, phone, service, message, hear_about } = body;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required' });
  }

  // Save to Supabase
  const lead = {
    first_name,
    last_name,
    email,
    phone: phone || null,
    service: service || null,
    message: message || null,
    hear_about: hear_about || null,
    status: 'new',
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase('leads', {
    method: 'POST',
    body: lead,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to save lead' });
  }

  // Send emails (non-blocking)
  // NOTE: Until a domain is verified in Resend, emails can only go to your own address.
  // Once you verify skinlaserchicago.com in Resend, change the thank you email 'to' back to [lead.email]
  // and update 'from' addresses to use @skinlaserchicago.com
  try {
    await sendNotificationEmail(lead);
  } catch (err) {
    console.error('Notification email failed:', err);
  }
  try {
    await sendThankYouEmail(lead);
  } catch (err) {
    console.error('Thank you email failed:', err);
  }

  res.status(201).json({ success: true, message: 'Consultation request received' });
}

async function handleGet(req, res) {
  const authError = verifyAuth(req);
  if (authError) {
    return res.status(401).json({ error: authError });
  }

  const { data, error } = await supabase('leads?order=created_at.desc', {
    method: 'GET',
  });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch leads' });
  }

  res.status(200).json(data);
}

async function sendNotificationEmail(lead) {
  const fullName = `${lead.first_name} ${lead.last_name}`;
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

  await sendEmail({
    from: 'Skin Laser & MedSpa <onboarding@resend.dev>',
    to: ['mcgrathcullin@gmail.com'],
    subject: `New Lead: ${fullName} - ${lead.service || 'General Inquiry'}`,
    html: `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F6F3EE;">
        <div style="background: #2C2825; padding: 24px 32px;">
          <h1 style="color: #D4B8A4; font-family: Georgia, serif; font-size: 20px; margin: 0;">New Consultation Request</h1>
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 6px 0 0;">${now} CT</p>
        </div>
        <div style="padding: 28px 32px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E4DDD3; width: 140px;">Name</td>
              <td style="padding: 12px 0; color: #1B1B1B; border-bottom: 1px solid #E4DDD3; font-size: 15px;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E4DDD3;">Email</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #E4DDD3; font-size: 15px;"><a href="mailto:${lead.email}" style="color: #1B1B1B;">${lead.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E4DDD3;">Phone</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #E4DDD3; font-size: 15px;"><a href="tel:${(lead.phone || '').replace(/\D/g,'')}" style="color: #1B1B1B;">${lead.phone || 'Not provided'}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E4DDD3;">Service</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #E4DDD3; font-size: 15px;">${lead.service || 'Not specified'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #E4DDD3;">Found Us Via</td>
              <td style="padding: 12px 0; border-bottom: 1px solid #E4DDD3; font-size: 15px;">${lead.hear_about || 'Not specified'}</td>
            </tr>
            ${lead.message ? `
            <tr>
              <td style="padding: 12px 0; font-weight: 600; color: #9E7C5E; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;">Message</td>
              <td style="padding: 12px 0; font-size: 15px; line-height: 1.6; color: #3A3632;">${lead.message}</td>
            </tr>
            ` : ''}
          </table>
          <div style="margin-top: 24px;">
            <a href="mailto:${lead.email}" style="display: inline-block; padding: 12px 24px; background: #9E7C5E; color: white; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px;">Reply to ${lead.first_name}</a>
            <a href="tel:${(lead.phone || '').replace(/\D/g,'')}" style="display: inline-block; padding: 12px 24px; background: #2C2825; color: white; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; margin-left: 8px;">Call ${lead.first_name}</a>
          </div>
        </div>
        <div style="padding: 16px 32px; border-top: 1px solid #E4DDD3; text-align: center;">
          <p style="color: #A89080; font-size: 11px; margin: 0;">Skin Laser & MedSpa | 220 E Illinois St, Suite 703, Chicago IL 60611</p>
        </div>
      </div>
    `,
  });
}

async function sendThankYouEmail(lead) {
  await sendEmail({
    from: 'Skin Laser & MedSpa <onboarding@resend.dev>',
    // TODO: Change back to [lead.email] after verifying domain in Resend
    to: ['mcgrathcullin@gmail.com'],
    subject: `Thank you, ${lead.first_name}! Your consultation request is confirmed`,
    html: `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #F6F3EE;">
        <!-- Header -->
        <div style="background: #2C2825; padding: 32px; text-align: center;">
          <h1 style="font-family: Georgia, serif; color: #FDFCFA; font-size: 22px; font-weight: 400; margin: 0; letter-spacing: 0.5px;">SKIN</h1>
          <p style="color: #D4B8A4; font-size: 10px; letter-spacing: 3px; margin: 4px 0 0; text-transform: uppercase;">Laser + MedSpa | Chicago</p>
        </div>

        <!-- Main content -->
        <div style="padding: 36px 32px 28px;">
          <h2 style="font-family: Georgia, serif; color: #1B1B1B; font-size: 24px; font-weight: 400; margin: 0 0 8px;">
            Thank you, ${lead.first_name}!
          </h2>
          <p style="color: #7A746B; font-size: 15px; line-height: 1.8; margin: 0 0 24px;">
            We're so glad you reached out. Your consultation request has been received and a member of our team will be in touch within 24 hours to discuss your goals and schedule your visit.
          </p>

          <!-- Request summary -->
          <div style="background: #FDFCFA; border: 1px solid #E4DDD3; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px;">
            <p style="font-size: 11px; font-weight: 600; color: #9E7C5E; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px;">Your Request</p>
            <p style="margin: 6px 0; font-size: 14px; color: #3A3632;"><strong>Service:</strong> ${lead.service || 'To be discussed'}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #3A3632;"><strong>Name:</strong> ${lead.first_name} ${lead.last_name}</p>
            ${lead.phone ? `<p style="margin: 6px 0; font-size: 14px; color: #3A3632;"><strong>Phone:</strong> ${lead.phone}</p>` : ''}
          </div>

          <!-- While you wait -->
          <p style="font-size: 11px; font-weight: 600; color: #9E7C5E; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px;">While You Wait</p>

          <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
            <tr>
              <td style="background: #FDFCFA; border: 1px solid #E4DDD3; border-radius: 6px; padding: 16px 20px;">
                <a href="https://skinlaserchicago.com/treatments.html" style="text-decoration: none;">
                  <p style="margin: 0 0 4px; font-weight: 600; color: #1B1B1B; font-size: 14px;">Explore Our Treatments</p>
                  <p style="margin: 0; color: #7A746B; font-size: 12px;">See our full range of laser and skin treatments</p>
                </a>
              </td>
            </tr>
            <tr>
              <td style="background: #FDFCFA; border: 1px solid #E4DDD3; border-radius: 6px; padding: 16px 20px;">
                <a href="https://skinlaserchicago.com/specials.html" style="text-decoration: none;">
                  <p style="margin: 0 0 4px; font-weight: 600; color: #1B1B1B; font-size: 14px;">Monthly Specials</p>
                  <p style="margin: 0; color: #7A746B; font-size: 12px;">Check out our current deals and packages</p>
                </a>
              </td>
            </tr>
            <tr>
              <td style="background: #FDFCFA; border: 1px solid #E4DDD3; border-radius: 6px; padding: 16px 20px;">
                <a href="https://skin-laser-medspa.myshopify.com/" style="text-decoration: none;">
                  <p style="margin: 0 0 4px; font-weight: 600; color: #1B1B1B; font-size: 14px;">Shop Skincare</p>
                  <p style="margin: 0; color: #7A746B; font-size: 12px;">Professional-grade products for your skin routine</p>
                </a>
              </td>
            </tr>
          </table>

          <!-- Call us -->
          <div style="text-align: center; margin: 28px 0 0;">
            <p style="color: #7A746B; font-size: 14px; margin: 0 0 12px;">Need to reach us sooner?</p>
            <a href="tel:3125395818" style="display: inline-block; padding: 14px 32px; background: #9E7C5E; color: white; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; border-radius: 6px;">Call (312) 539-5818</a>
          </div>
        </div>

        <!-- Warm sign-off -->
        <div style="padding: 0 32px 32px;">
          <p style="font-family: Georgia, serif; font-style: italic; color: #9E7C5E; font-size: 15px; line-height: 1.6;">
            We look forward to helping you look and feel your personal best.
          </p>
          <p style="color: #3A3632; font-size: 14px; margin: 0;">
            Warm regards,<br>
            <strong>Kimberly &amp; The Skin Laser Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #2C2825; padding: 20px 32px; text-align: center;">
          <p style="color: #A89080; font-size: 11px; margin: 0 0 4px;">Skin Laser &amp; MedSpa</p>
          <p style="color: rgba(255,255,255,0.35); font-size: 11px; margin: 0;">220 E Illinois St, Suite 703, Chicago IL 60611 | (312) 539-5818</p>
        </div>
      </div>
    `,
  });
}

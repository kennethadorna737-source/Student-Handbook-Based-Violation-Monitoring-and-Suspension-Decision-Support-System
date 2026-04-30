// @ts-nocheck
import { createClient } from '$supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL'); // your verified sender email in Brevo
    const senderName = Deno.env.get('BREVO_SENDER_NAME') ?? 'PhilTechGMA Admin';

    if (!supabaseUrl || !supabaseAnonKey || !brevoApiKey || !senderEmail) {
      return new Response(
        JSON.stringify({
          error: 'Server configuration error: missing env vars (SUPABASE_URL, SUPABASE_ANON_KEY, BREVO_API_KEY, BREVO_SENDER_EMAIL)',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin_users table first, fall back to user_metadata.role
    let isAdmin = false;
    const { data: adminRow } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminRow) {
      isAdmin = true;
    } else if (user.user_metadata?.role === 'admin') {
      isAdmin = true;
    }

    if (!isAdmin) {
      console.warn(`Forbidden: user ${user.id} is not an admin`);
      return new Response(JSON.stringify({ error: 'Forbidden: admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email via Brevo (Sendinblue) API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          { email: to },
        ],
        subject: subject,
        textContent: body,
        // Optional: also send as HTML (converts newlines to <br>)
        htmlContent: `<pre style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap;">${body}</pre>`,
      }),
    });

    const brevoResult = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error('Brevo API error:', brevoResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send email via Brevo', details: brevoResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully via Brevo:', brevoResult);

    return new Response(JSON.stringify({ success: true, messageId: brevoResult.messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
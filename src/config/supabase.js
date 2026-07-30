const { createClient } = require('@supabase/supabase-js');

// Backend uses the SERVICE ROLE key so it can bypass RLS and enforce
// tenant scoping itself via tenantContext middleware — until login/auth
// is built and the JWT-based RLS policies (see migrations) take over.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;

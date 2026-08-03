const { createClient } = require('@supabase/supabase-js');

// Backend uses the SERVICE ROLE key so it can call supabase.auth.admin.*
// (user creation) and bypass RLS for its own app-layer tenant scoping via
// src/middleware/authenticate.js (req.schoolId comes from the verified JWT).
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabase;
// supabase.js — Supabase client initialization (graceful if no credentials)
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let supabaseAvailable = false;

function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key || url === 'your_supabase_url_here' || key === 'your_supabase_anon_key_here') {
    console.log('⚠️  Supabase credentials not configured. Running without persistence.');
    console.log('   Set SUPABASE_URL and SUPABASE_ANON_KEY in .env to enable database.\n');
    return;
  }

  try {
    supabase = createClient(url, key);
    supabaseAvailable = true;
    console.log('✅ Supabase connected successfully.\n');
  } catch (error) {
    console.log('⚠️  Supabase connection failed:', error.message);
    console.log('   Running without persistence.\n');
  }
}

// Initialize on module load
initSupabase();

function getClient() {
  return supabase;
}

function isAvailable() {
  return supabaseAvailable;
}

module.exports = { getClient, isAvailable };

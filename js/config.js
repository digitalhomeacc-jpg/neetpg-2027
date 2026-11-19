// Sync settings for this app's Supabase project. These two values are safe to publish:
// the anon key only allows what the database's row-level security rules allow
// (each signed-in person reads and writes their own row, nothing else).
// Fill them in once (see tools/supabase.sql), or enter them in Settings → Sync on a device.
export const SYNC = {
  url: 'https://fudagzfmlmnajbjxhxni.supabase.co',
  anonKey: 'sb_publishable__xFfVdvWbrb8oGRQxMVpWw_tIOx4gBZ',  // publishable (anon) key
};

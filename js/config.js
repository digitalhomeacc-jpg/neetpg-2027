// Sync settings for this app's Supabase project. These two values are safe to publish:
// the anon key only allows what the database's row-level security rules allow
// (each signed-in person reads and writes their own row, nothing else).
// Fill them in once (see tools/supabase.sql), or enter them in Settings → Sync on a device.
export const SYNC = {
  url: '',      // e.g. https://abcdefgh.supabase.co
  anonKey: '',  // Project Settings → API → anon public key
};

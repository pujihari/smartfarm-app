import { createClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

const supabaseUrl = environment.supabaseUrl;
const supabaseKey = environment.supabaseKey;

// A no-op lock function to disable the problematic Navigator LockManager.
const noOpLock = async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
  return await fn()
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    lock: noOpLock,
  },
});
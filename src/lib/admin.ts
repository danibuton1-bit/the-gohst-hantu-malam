import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "./account";

/** Admin = first registered ID card; checked on the server by id + kode_id. */
export function useIsAdmin(account: Profile | null) {
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!account) { setAdmin(null); return; }
    let alive = true;
    void supabase.rpc("is_admin", { p_id: account.id, p_kode: account.kode_id }).then(({ data }) => { if (alive) setAdmin(data === true); });
    return () => { alive = false; };
  }, [account]);
  return admin;
}

import { supabase } from "@/integrations/supabase/client";
import { normalizeChar, type CharId } from "./art";

export type Profile = {
  id: string;
  nama: string;
  tanggal_lahir: string;
  username: string;
  kode_id: string;
  karakter_pilihan: CharId;
  created_at: string;
};

const KEY = "hantu-malam-akun";

export function loadAccount(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Profile;
    const k = normalizeChar(p.karakter_pilihan);
    if (!p.id || !p.kode_id || !k) return null;
    p.karakter_pilihan = k;
    return p;
  } catch {
    return null;
  }
}
export const saveAccount = (p: Profile) => localStorage.setItem(KEY, JSON.stringify(p));
export const logout = () => localStorage.removeItem(KEY);

export async function createProfile(nama: string, tanggal: string, karakter: CharId) {
  const { data, error } = await supabase.rpc("create_profile", { p_nama: nama, p_tanggal: tanggal, p_karakter: karakter });
  if (error) throw new Error(error.message);
  return data as unknown as Profile;
}

export type LoginResult = { status: "ok"; profile: Profile } | { status: "notfound" } | { status: "need_password" } | { status: "wrong" };
export async function loginIdCard(kode: string, nama: string, password = ""): Promise<LoginResult> {
  const { data, error } = await supabase.rpc("login_secure", { p_kode: kode, p_nama: nama, p_pass: password });
  if (error) throw new Error(error.message);
  return data as unknown as LoginResult;
}

export async function hasPassword(p: Profile) {
  const { data, error } = await supabase.rpc("has_password", { p_id: p.id, p_kode: p.kode_id });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Set, change (needs old) or remove (newPass "") the account lock password. */
export async function setPassword(p: Profile, oldPass: string, newPass: string) {
  const { error } = await supabase.rpc("set_password", { p_id: p.id, p_kode: p.kode_id, p_old: oldPass, p_new: newPass });
  if (error) throw new Error(error.message);
}

export const qrPayload = (p: Profile) => `HANTUMALAM|${p.kode_id}|${p.username}`;
export function parseQr(text: string): { kode: string; username: string } | null {
  const m = /^HANTUMALAM\|(HM-\d{4})\|(.+)$/.exec(text.trim());
  return m ? { kode: m[1]!, username: m[2]! } : null;
}

export function formatTanggal(d: string) {
  const [y, m, day] = d.split("-");
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${day} ${bulan[Number(m) - 1] ?? ""} ${y}`;
}

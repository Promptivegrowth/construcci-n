import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

/** URLs firmadas (1 h) para evidencias privadas; respeta las políticas de Storage del usuario. */
export async function signedUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter(Boolean) as string[])];
  if (!list.length) return new Map<string, string>();
  const sb = await supabaseServer();
  const { data } = await sb.storage.from("evidencias").createSignedUrls(list, 3600);
  return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl]));
}

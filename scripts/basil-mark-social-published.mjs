import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const root = resolve(import.meta.dirname, "..");
for (const filename of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(root, filename), "utf8").split(/\r?\n/)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      process.env[match[1]] = value.replaceAll("\\n", "\n");
    }
  } catch {
    // Scheduled tasks may provide environment variables directly.
  }
}
const option = (name) => process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
const variantId = option("--variant-id");
const publishedUrl = option("--url");
const externalId = option("--external-id") || null;
if (!/^[0-9a-f-]{36}$/i.test(variantId)) throw new Error("Pass --variant-id=<uuid>.");
if (!/^https:\/\//i.test(publishedUrl) || publishedUrl.length > 2000) throw new Error("Pass the confirmed public HTTPS post URL as --url=<url>.");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are required.");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: variant, error: readError } = await supabase.from("basil_social_variants").select("id,status,published_url").eq("id", variantId).maybeSingle();
if (readError) throw readError;
if (!variant) throw new Error("The Social Studio variant does not exist.");
if (variant.status === "published" && variant.published_url === publishedUrl) {
  console.log(JSON.stringify({ ok: true, alreadyRecorded: true, variantId, publishedUrl }));
  process.exit(0);
}
if (variant.status !== "manual_ready") throw new Error("Only an explicitly approved Social Studio variant can be marked published.");
const now = new Date().toISOString();
const { error: updateError } = await supabase.from("basil_social_variants").update({
  status: "published",
  published_at: now,
  published_url: publishedUrl,
  external_id: externalId,
  last_error: null,
  updated_at: now,
}).eq("id", variantId).eq("status", "manual_ready");
if (updateError) throw updateError;
console.log(JSON.stringify({ ok: true, variantId, publishedUrl }));

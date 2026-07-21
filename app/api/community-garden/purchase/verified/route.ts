import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { recordBasilFunnelEvent } from "@/lib/communityGarden/funnel";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid verification origin." }, { status: 403 });
  }

  const user = await getGardenUser(request);
  const userEmail = user?.email?.trim().toLowerCase();
  if (!user || !userEmail) {
    return NextResponse.json({ error: "Verify your Basil account first." }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: pending, error } = await supabase
    .from("garden_pending_purchases")
    .select("id,launch_session_id,buyer_email,status")
    .eq("claimed_user_id", user.id)
    .in("status", ["activation_sent", "claimed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!pending) return NextResponse.json({ finalized: false });
  if (pending.buyer_email && pending.buyer_email !== userEmail) {
    return NextResponse.json({ error: "This purchase belongs to another email." }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from("garden_pending_purchases")
    .update({
      status: "claimed",
      buyer_email: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id);
  if (updateError) throw updateError;

  if (pending.launch_session_id) {
    await recordBasilFunnelEvent({
      launchSessionId: pending.launch_session_id,
      event: "verification_completed",
      sourceKey: `paid-verified:${pending.id}`,
    });
  }

  return NextResponse.json({ finalized: true });
}

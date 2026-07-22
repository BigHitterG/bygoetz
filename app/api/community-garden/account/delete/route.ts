import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { PENDING_GARDEN_CLAIM_COOKIE } from "@/lib/communityGarden/pendingPurchase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const CONFIRMATION = "DELETE MY GARDEN";
const MAX_REAUTH_AGE_SECONDS = 5 * 60;

function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1] ?? null;
}

function tokenIssuedAt(token: string) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as {
      iat?: unknown;
    };
    return typeof payload.iat === "number" ? payload.iat : null;
  } catch {
    return null;
  }
}

function deletionFingerprint(userId: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Basil account deletion is not configured.");
  return createHmac("sha256", secret).update(`basil-deletion:${userId}`).digest("hex");
}

async function updateAudit(
  requestId: string,
  values: Record<string, string | number | null>,
) {
  await getSupabaseAdmin()
    .from("garden_account_deletion_requests")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", requestId);
}

function responseWithClearedClaim(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.cookies.set(PENDING_GARDEN_CLAIM_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/community-garden",
    maxAge: 0,
  });
  return response;
}

export async function DELETE(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (
    requestOrigin &&
    requestOrigin !== request.nextUrl.origin &&
    requestOrigin !== configuredOrigin
  ) {
    return NextResponse.json({ error: "Invalid account deletion origin." }, { status: 403 });
  }

  const token = bearerToken(request);
  const user = token ? await getGardenUser(request) : null;
  if (!token || !user?.email) {
    return NextResponse.json({ error: "Sign in again before deleting this account." }, { status: 401 });
  }

  const issuedAt = tokenIssuedAt(token);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!issuedAt || issuedAt > nowSeconds + 30 || nowSeconds - issuedAt > MAX_REAUTH_AGE_SECONDS) {
    return NextResponse.json(
      { error: "For your protection, enter your password again before deletion." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as { confirmation?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: `Type ${CONFIRMATION} to confirm.` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const fingerprint = deletionFingerprint(user.id);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from("garden_account_deletion_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_fingerprint", fingerprint)
    .gte("created_at", oneHourAgo);
  if (countError) {
    return NextResponse.json({ error: "Deletion could not start. Please try again." }, { status: 503 });
  }
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Too many deletion attempts. Wait an hour or contact Support." },
      { status: 429 },
    );
  }

  const { count: sharedPlantCountBefore, error: sharedCountError } = await supabase
    .from("community_garden_plants")
    .select("id", { count: "exact", head: true });
  if (sharedCountError) {
    return NextResponse.json({ error: "Deletion safety check failed. Please try again." }, { status: 503 });
  }

  const { data: audit, error: auditError } = await supabase
    .from("garden_account_deletion_requests")
    .insert({
      user_fingerprint: fingerprint,
      shared_plant_count_before: sharedPlantCountBefore ?? 0,
    })
    .select("id")
    .single();
  if (auditError || !audit?.id) {
    return NextResponse.json({ error: "Deletion could not start. Please try again." }, { status: 503 });
  }
  const requestId = String(audit.id);
  let stage = "private_cleanup";

  try {
    const { error: pendingByUserError } = await supabase
      .from("garden_pending_purchases")
      .delete()
      .eq("claimed_user_id", user.id);
    if (pendingByUserError) throw pendingByUserError;

    const { error: pendingByEmailError } = await supabase
      .from("garden_pending_purchases")
      .delete()
      .eq("buyer_email", user.email.trim().toLowerCase());
    if (pendingByEmailError) throw pendingByEmailError;

    stage = "session_revocation";
    const { error: signOutError } = await supabase.auth.admin.signOut(token, "global");
    if (signOutError) throw signOutError;

    stage = "auth_deletion";
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw deleteError;

    stage = "public_integrity_check";
    const { count: sharedPlantCountAfter, error: afterCountError } = await supabase
      .from("community_garden_plants")
      .select("id", { count: "exact", head: true });
    if (afterCountError) throw afterCountError;

    const sharedIntegrityHeld = sharedPlantCountAfter === sharedPlantCountBefore;
    await updateAudit(requestId, {
      status: "completed",
      failure_stage: sharedIntegrityHeld ? null : "public_integrity_warning",
      error_code: sharedIntegrityHeld ? null : "shared_count_changed_during_request",
      shared_plant_count_after: sharedPlantCountAfter ?? 0,
      completed_at: new Date().toISOString(),
    });

    console.info("Basil account deletion completed", {
      requestId,
      sharedIntegrityHeld,
    });
    return responseWithClearedClaim({ deleted: true, requestId });
  } catch (error) {
    const errorCode = error instanceof Error && error.name ? error.name.slice(0, 80) : "unknown_error";
    await updateAudit(requestId, {
      status: "failed",
      failure_stage: stage,
      error_code: errorCode,
    }).catch(() => undefined);
    console.error("Basil account deletion failed", { requestId, stage, errorCode });
    return NextResponse.json(
      {
        error: "Deletion did not finish. Your request was retained so you can retry or contact Support.",
        requestId,
      },
      { status: 503 },
    );
  }
}

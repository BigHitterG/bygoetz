import { NextResponse } from "next/server";
import { getGardenUser } from "@/lib/communityGarden/auth";
import { getMyGarden } from "@/lib/communityGarden/myGarden";
import {
  getGardenAlmanac,
  getGardenFeedback,
  getGardenStewardByUserId,
} from "@/lib/communityGarden/stewards";
import { getNewsletterPreference } from "@/lib/communityGarden/newsletter";
import { isGardenAdmin } from "@/lib/communityGarden/health";
import { getHeritageSeedStatus } from "@/lib/communityGarden/heritageSeeds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getGardenUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to view this account." }, { status: 401 });
  }

  const steward = await getGardenStewardByUserId(user.id);
  const admin = isGardenAdmin(user);

  if (!steward) {
    return NextResponse.json({ active: false, email: user.email, admin });
  }

  const [almanac, feedback, myGarden, newsletterPreference, heritage] = await Promise.all([
    getGardenAlmanac(),
    getGardenFeedback(steward.id),
    getMyGarden(steward.id),
    getNewsletterPreference(user.id),
    getHeritageSeedStatus(user.id),
  ]);

  return NextResponse.json({
    active: true,
    steward: {
      gardenName: steward.garden_name,
      purchasedAt: steward.purchased_at,
      email: user.email,
    },
    almanac,
    feedback,
    myGarden,
    admin,
    newsletterSubscribed: newsletterPreference !== false,
    heritage,
  });
}

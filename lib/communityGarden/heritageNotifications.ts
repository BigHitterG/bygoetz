import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function getHeritageNotifications(userId: string) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "get_community_garden_heritage_notifications_v1",
    { p_user_id: userId },
  );
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function acknowledgeHeritageNotifications(
  userId: string,
  notificationIds: string[],
) {
  const { data, error } = await getSupabaseAdmin().rpc(
    "acknowledge_community_garden_heritage_notifications_v1",
    {
      p_user_id: userId,
      p_notification_ids: notificationIds,
    },
  );
  if (error) throw error;
  return data && typeof data === "object" ? data : { acknowledged: 0 };
}

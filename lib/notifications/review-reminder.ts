import { pool } from "@/lib/db/client";

/**
 * Get the number of review items due for a user (due_date <= now, not mastered).
 */
export async function getDueCount(userId: number): Promise<number> {
  const res = await pool.query(
    `SELECT COUNT(*) as count FROM review_items
     WHERE user_id = $1 AND due_date <= NOW() AND state != 'mastered'`,
    [userId]
  );
  return parseInt(res.rows[0].count, 10) || 0;
}

/**
 * Persist a Web Push subscription for a user. Uses ON CONFLICT so re-subscribes
 * (same endpoint) are idempotent.
 */
export async function savePushSubscription(
  userId: number,
  subscription: PushSubscriptionJSON
): Promise<void> {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO NOTHING`,
    [
      userId,
      subscription.endpoint,
      subscription.keys?.p256dh ?? null,
      subscription.keys?.auth ?? null,
    ]
  );
}

/**
 * Get all Web Push subscriptions for a user.
 */
export async function getPushSubscriptions(
  userId: number
): Promise<PushSubscriptionJSON[]> {
  const res = await pool.query(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  return res.rows.map((row) => ({
    endpoint: row.endpoint,
    keys: row.p256dh && row.auth ? { p256dh: row.p256dh, auth: row.auth } : undefined,
  }));
}

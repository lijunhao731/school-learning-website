import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { savePushSubscription } from "@/lib/notifications/review-reminder";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subscription: PushSubscriptionJSON };
  try {
    body = (await request.json()) as { subscription: PushSubscriptionJSON };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.subscription?.endpoint) {
    return NextResponse.json(
      { error: "Missing subscription endpoint" },
      { status: 400 }
    );
  }

  try {
    await savePushSubscription(session.user.id, body.subscription);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}

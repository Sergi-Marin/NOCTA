"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@nocta/database";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import type { StripePlan } from "@/lib/stripe";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.discordId) redirect("/login");
  return session;
}

export async function toggleModule(guildId: string, moduleId: string) {
  const session = await requireSession();

  const guild = await db.guild.findUnique({ where: { discordId: guildId } });
  if (!guild) throw new Error("Guild not found");

  // Verify user has a presence in the DB (signed in)
  const dbUser = await db.user.findUnique({
    where: { discordId: session.user.discordId },
  });
  if (!dbUser) throw new Error("User not found");

  const isActive = guild.activeModules.includes(moduleId);
  const activeModules = isActive
    ? guild.activeModules.filter((m) => m !== moduleId)
    : [...guild.activeModules, moduleId];

  await db.guild.update({ where: { discordId: guildId }, data: { activeModules } });
  revalidatePath(`/dashboard/${guildId}`);
}

export async function createCheckoutSession(plan: StripePlan) {
  const session = await requireSession();

  const dbUser = await db.user.findUnique({
    where: { discordId: session.user.discordId },
  });
  if (!dbUser) throw new Error("User not found");

  const priceId = STRIPE_PRICES[plan];

  const stripeSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: dbUser.email ?? undefined,
    metadata: { discordId: session.user.discordId, plan },
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?upgraded=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  });

  if (stripeSession.url) redirect(stripeSession.url);
}

export async function createPortalSession() {
  const session = await requireSession();

  const dbUser = await db.user.findUnique({
    where: { discordId: session.user.discordId },
  });
  if (!dbUser?.stripeCustomerId) throw new Error("No active subscription");

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  });

  redirect(portalSession.url);
}

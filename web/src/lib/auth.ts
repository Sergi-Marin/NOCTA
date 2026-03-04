import { type NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "@nocta/database";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // `guilds` scope lets us fetch the user's server list via the Discord API
      authorization: { params: { scope: "identify email guilds" } },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "discord") return false;

      // Upsert the Discord user into our DB on every sign-in so
      // username / avatar stay fresh.
      await db.user.upsert({
        where: { discordId: user.id },
        update: {
          username: user.name ?? "Unknown",
          avatarUrl: user.image ?? null,
        },
        create: {
          discordId: user.id,
          username: user.name ?? "Unknown",
          email: user.email ?? null,
          avatarUrl: user.image ?? null,
        },
      });

      return true;
    },

    async jwt({ token, account, user }) {
      // `account` and `user` are only present on the initial sign-in
      if (account && user) {
        token.discordId = user.id;
        token.accessToken = account.access_token;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.discordId) session.user.discordId = token.discordId;
      if (token.accessToken) session.user.accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
};

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NOCTA — AI Voice Assistant for Discord",
  description:
    "NOCTA is an AI-powered voice assistant for Discord. Say 'Nocta' to activate, ask anything, and get instant spoken responses powered by Claude AI.",
  keywords: ["Discord bot", "AI assistant", "voice bot", "Claude AI", "Discord voice"],
  openGraph: {
    title: "NOCTA — AI Voice Assistant for Discord",
    description:
      "Say 'Nocta' in any voice channel. Get instant AI-powered spoken answers.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerSession(authOptions);
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}

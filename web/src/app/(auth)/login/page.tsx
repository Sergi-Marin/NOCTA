import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LoginButton } from "@/components/auth/login-button";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-8 text-center px-4">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center glow-violet-sm">
            <span className="text-3xl font-bold text-violet-400">N</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to <span className="text-gradient">NOCTA</span>
          </h1>
          <p className="text-muted-foreground max-w-sm">
            Sign in with Discord to access your dashboard and configure your AI
            voice assistant.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <LoginButton />
          <p className="mt-4 text-xs text-muted-foreground">
            By signing in you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

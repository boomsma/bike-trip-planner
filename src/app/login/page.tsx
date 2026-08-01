import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <AuthForm action={login} submitLabel="Log in" />
      <p className="text-sm">
        No account?{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}

import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signup } from "../login/actions";

export default function SignupPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <AuthForm action={signup} submitLabel="Sign up" />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  );
}

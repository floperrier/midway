import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { signIn } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";
import { Field, ValidatedForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      setError(error.message ?? "That email and password don't match.");
      setPending(false);
      return;
    }
    await router.invalidate();
    router.navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Sign in"
      intro="Pick up where you left off."
      footer={
        <>
          No account yet?{" "}
          <Link to="/register" className="text-foreground underline">
            Create one
          </Link>
        </>
      }
    >
      <ValidatedForm onSubmit={onSubmit} className="grid gap-5">
        <Field label="Email" error="Enter a valid email address.">
          <Input
            type="email"
            name="email"
            required
            autoComplete="email"
            spellCheck={false}
            autoCapitalize="none"
            placeholder="you@agency.com"
          />
        </Field>

        <Field label="Password" error="Enter your password.">
          <Input
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </ValidatedForm>
    </AuthShell>
  );
}

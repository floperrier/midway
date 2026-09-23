import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { signUp } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth-shell";
import { Field, ValidatedForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/register")({ component: RegisterPage });

function RegisterPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);

    const { error } = await signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (error) {
      setError(error.message ?? "That account could not be created.");
      setPending(false);
      return;
    }
    await router.invalidate();
    router.navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Open a booth"
      intro="One account runs every brand you manage."
      footer={
        <>
          Already signed up?{" "}
          <Link to="/login" className="text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <ValidatedForm onSubmit={onSubmit} className="grid gap-5">
        <Field label="Name" error="Tell us what to call you.">
          <Input name="name" required autoComplete="name" placeholder="Alex Roy" />
        </Field>

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

        <Field
          label="Password"
          hint="At least 8 characters."
          error="Use at least 8 characters."
        >
          <Input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
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
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </ValidatedForm>
    </AuthShell>
  );
}

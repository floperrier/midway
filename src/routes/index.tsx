import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSessionFn } from "@/server/functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    throw redirect({ to: session ? "/dashboard" : "/login" });
  },
});

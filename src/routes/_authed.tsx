import { useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { LayoutGrid, Menu, Store, Ticket } from "lucide-react";
import { getSessionFn } from "@/server/functions";
import { signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
    return { user: session.user };
  },
  component: AuthedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/brands", label: "Brands", icon: Store },
  { to: "/campaigns", label: "Campaigns", icon: Ticket },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="grid gap-0.5" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          activeProps={{
            className:
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          }}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    await router.invalidate();
    router.navigate({ to: "/login" });
  }

  const booth = (
    <div className="flex h-full flex-col gap-8 p-4">
      <Link to="/dashboard" className="numeral text-ticket px-2 text-2xl">
        MIDWAY
      </Link>
      <NavLinks onNavigate={() => setOpen(false)} />
      <div className="border-sidebar-border mt-auto grid gap-2 border-t pt-4">
        <p className="text-sidebar-foreground/60 truncate px-3 text-xs">
          {user.email}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground justify-start"
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <a
        href="#main"
        className="bg-background text-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded focus:px-4 focus:py-2 focus:ring-2"
      >
        Skip to content
      </a>
      <aside className="bg-sidebar hidden md:block">{booth}</aside>

      <div className="flex min-w-0 flex-col">
        <header className="border-border flex items-center gap-2 border-b px-4 py-3 md:justify-end">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="size-5" aria-hidden />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar w-64 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              {booth}
            </SheetContent>
          </Sheet>
          <span className="numeral text-ticket text-xl md:hidden">MIDWAY</span>
          <div className="ml-auto md:ml-0">
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

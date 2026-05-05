import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LanguageSwitcher } from "@/components/auth/LanguageSwitcher";
import { Menu, X } from "lucide-react";

export function LandingHeader({ showLanguageSwitcher = true }: { showLanguageSwitcher?: boolean } = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link to="/" className="shrink-0">
          <img
            src="/brand/logo-hubfy-dark.svg"
            alt="Hubfy"
            className="h-6 dark:hidden"
          />
          <img
            src="/brand/logo-hubfy-light.svg"
            alt="Hubfy"
            className="hidden h-6 dark:block"
          />
        </Link>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/#product">Product</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/#clients">Clients</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pricing">Pricing</Link>
          </Button>
        </nav>

        {/* Actions desktop */}
        <div className="hidden items-center gap-2 md:flex">
          {showLanguageSwitcher && <LanguageSwitcher />}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/login">Login</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/admin/signup">Get Started</Link>
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border/40 bg-background px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            <Button variant="ghost" size="sm" className="justify-start" asChild>
              <Link to="/#product" onClick={() => setMobileMenuOpen(false)}>Product</Link>
            </Button>
            <Button variant="ghost" size="sm" className="justify-start" asChild>
              <Link to="/#clients" onClick={() => setMobileMenuOpen(false)}>Clients</Link>
            </Button>
            <Button variant="ghost" size="sm" className="justify-start" asChild>
              <Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            </Button>
          </nav>
          <Separator className="my-2" />
          <div className="flex flex-col gap-2">
            {showLanguageSwitcher && (
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <span className="text-sm text-muted-foreground">Idioma</span>
              </div>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/login">Login</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/admin/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

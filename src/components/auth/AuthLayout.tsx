import { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { BRAND_NAME, BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/brand";

interface AuthLayoutProps {
  /** Conteúdo do formulário (lado esquerdo) */
  children: ReactNode;
  /** Caminho da imagem hero (lado direito) */
  heroImage: string;
}

/**
 * Layout compartilhado para telas de autenticação.
 * Esquerda: formulário centralizado.
 * Direita: imagem dentro de container com padding e border-radius.
 */
export function AuthLayout({ children, heroImage }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Logo no topo esquerdo */}
      <div className="fixed top-0 left-0 z-10 p-6 lg:p-8">
        <img
          src={BRAND_LOGO_LIGHT}
          alt={BRAND_NAME}
          className="h-[28px] w-auto hidden dark:block"
        />
        <img
          src={BRAND_LOGO_DARK}
          alt={BRAND_NAME}
          className="h-[28px] w-auto dark:hidden"
        />
      </div>

      {/* Seletor de idioma no topo direito */}
      <div className="fixed top-0 right-0 z-10 p-6 lg:p-8 lg:right-[500px]">
        <LanguageSwitcher />
      </div>

      {/* Imagem fixa à direita */}
      <div className="fixed inset-y-0 right-0 hidden lg:block w-[500px] p-[18px]">
        <img
          src={heroImage}
          alt=""
          className="h-full w-full rounded-xl object-cover"
        />
      </div>

      {/* Formulário ocupa o espaço restante */}
      <div className="flex min-h-screen items-center justify-center px-6 py-12 lg:pr-[500px]">
        <div className="w-full max-w-[390px] space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

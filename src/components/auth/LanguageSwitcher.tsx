import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FlagBR, FlagES, FlagUS } from "@/components/ui/flags";
import { useLanguage, type Language } from "@/hooks/useLanguage";

interface LanguageSwitcherProps {
  /** When provided, language change is persisted to the user's profile in DB */
  userId?: string | null;
}

export function LanguageSwitcher({ userId }: LanguageSwitcherProps = {}) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          title={t("language.label")}
          aria-label={t("language.label")}
        >
          {language === "pt-BR" ? (
            <FlagBR className="size-5" />
          ) : language === "es" ? (
            <FlagES className="size-5" />
          ) : (
            <FlagUS className="size-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuRadioGroup
          value={language}
          onValueChange={(v) => setLanguage(v as Language, userId)}
        >
          <DropdownMenuRadioItem value="en" className="gap-2">
            <FlagUS className="size-4" />
            {t("language.en")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="es" className="gap-2">
            <FlagES className="size-4" />
            {t("language.es")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pt-BR" className="gap-2">
            <FlagBR className="size-4" />
            {t("language.pt-BR")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

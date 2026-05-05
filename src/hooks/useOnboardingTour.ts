import { useCallback, useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/styles/onboarding-tour.css";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

const SEEN_KEY_PREFIX = "hubfy.onboarding.tour.seen:";

interface Options {
  autoStart?: boolean;
}

export function useOnboardingTour({ autoStart = false }: Options = {}) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const driverRef = useRef<Driver | null>(null);

  const seenKey = user?.id ? `${SEEN_KEY_PREFIX}${user.id}` : null;

  const buildDriver = useCallback((): Driver => {
    return driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.6,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: "hubfy-tour",
      nextBtnText: t("onboarding.tour.next", "Próximo"),
      doneBtnText: t("onboarding.tour.done", "Concluir"),
      showButtons: ["next", "close"],
      progressText: "{{current}} / {{total}}",
      onPopoverRender: (popover) => {
        if (popover.footerButtons.querySelector(".hubfy-tour-skip")) return;
        const skipBtn = document.createElement("button");
        skipBtn.type = "button";
        skipBtn.className = "hubfy-tour-skip driver-popover-prev-btn";
        skipBtn.textContent = t("onboarding.tour.skip", "Pular");
        skipBtn.addEventListener("click", () => {
          driverRef.current?.destroy();
        });
        popover.footerButtons.insertBefore(skipBtn, popover.nextButton);
      },
      steps: [
        {
          popover: {
            title: t("onboarding.tour.step1.title", "Bem-vindo! 👋"),
            description: t(
              "onboarding.tour.step1.desc",
              "Em 5 passos rápidos vamos te mostrar as áreas principais da plataforma. Você pode pular a qualquer momento no X."
            ),
          },
        },
        {
          element: '[data-tour="dashboard-kpis"]',
          popover: {
            title: t("onboarding.tour.step2.title", "Seu Dashboard"),
            description: t(
              "onboarding.tour.step2.desc",
              "Acompanhe receita, vendas recentes, crescimento mês a mês e os produtos que mais vendem — tudo em tempo real."
            ),
            side: "bottom",
            align: "start",
          },
        },
        {
          element: '[data-tour="nav-integrations"]',
          popover: {
            title: t("onboarding.tour.step3.title", "Integrações & Gateway"),
            description: t(
              "onboarding.tour.step3.desc",
              "Conecte seu gateway de pagamento (Stripe, Hotmart, Kiwify, Lastlink…), provedor de e-mail e hospedagem de vídeo."
            ),
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="nav-products"]',
          popover: {
            title: t("onboarding.tour.step4.title", "Produtos & Cursos"),
            description: t(
              "onboarding.tour.step4.desc",
              "Crie produtos digitais, monte cursos com módulos e aulas, e organize seu conteúdo. Tudo aqui."
            ),
            side: "right",
            align: "center",
          },
        },
        {
          element: '[data-tour="nav-customers"]',
          popover: {
            title: t("onboarding.tour.step5.title", "Alunos"),
            description: t(
              "onboarding.tour.step5.desc",
              "Importe alunos via CSV, gerencie sua base e acompanhe os pedidos da sua plataforma."
            ),
            side: "right",
            align: "center",
          },
        },
      ],
      onDestroyed: () => {
        if (seenKey) localStorage.setItem(seenKey, "1");
      },
    });
  }, [t, seenKey]);

  const startTour = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = buildDriver();
    driverRef.current.drive();
  }, [buildDriver]);

  useEffect(() => {
    if (!autoStart || !seenKey) return;
    if (localStorage.getItem(seenKey) === "1") return;
    const timer = window.setTimeout(() => startTour(), 600);
    return () => window.clearTimeout(timer);
  }, [autoStart, seenKey, startTour]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return { startTour };
}

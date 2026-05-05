import { useState, useEffect, useRef, ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { BRAND_NAME, BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "@/lib/brand";

/* ─────────────────────────────────────────────
   Pupil — bolinha preta que segue o mouse
   ───────────────────────────────────────────── */
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY,
}: PupilProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined)
      return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div
      ref={ref}
      className="rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
}

/* ─────────────────────────────────────────────
   EyeBall — olho com iris que segue o mouse
   ───────────────────────────────────────────── */
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined)
      return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div
      ref={ref}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: size,
        height: isBlinking ? 2 : size,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: pupilSize,
            height: pupilSize,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Hook para blinking aleatório
   ───────────────────────────────────────────── */
function useRandomBlink() {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeout = setTimeout(
        () => {
          setIsBlinking(true);
          setTimeout(() => {
            setIsBlinking(false);
            schedule();
          }, 150);
        },
        Math.random() * 4000 + 3000,
      );
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return isBlinking;
}

/* ─────────────────────────────────────────────
   AnimatedCharacters — personagens que ficam
   no painel esquerdo e reagem ao formulário
   ───────────────────────────────────────────── */
export interface CharacterState {
  /** campo de email focado */
  isTypingEmail: boolean;
  /** campo de senha focado */
  isTypingPassword: boolean;
  /** senha visível (olho aberto) */
  showPassword: boolean;
  /** senha já tem valor */
  hasPassword: boolean;
}

function AnimatedCharacters({ isTypingEmail, isTypingPassword, showPassword, hasPassword }: CharacterState) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  const isPurpleBlinking = useRandomBlink();
  const isBlackBlinking = useRandomBlink();

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  const isTyping = isTypingEmail || isTypingPassword;
  const hideEyes = hasPassword && !showPassword;
  const peekMode = hasPassword && showPassword;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Personagens se olham quando começa a digitar
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    }
    setIsLookingAtEachOther(false);
  }, [isTyping]);

  // Purple espia quando a senha fica visível
  useEffect(() => {
    if (!peekMode) {
      setIsPurplePeeking(false);
      return;
    }
    const id = setTimeout(
      () => {
        setIsPurplePeeking(true);
        setTimeout(() => setIsPurplePeeking(false), 800);
      },
      Math.random() * 3000 + 2000,
    );
    return () => clearTimeout(id);
  }, [peekMode, isPurplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const pp = calcPos(purpleRef);
  const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef);
  const op = calcPos(orangeRef);

  return (
    <div className="relative" style={{ width: 550, height: 400 }}>
      {/* Purple - fundo */}
      <div
        ref={purpleRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 70,
          width: 180,
          height: isTyping || hideEyes ? 440 : 400,
          backgroundColor: "#6C3FF5",
          borderRadius: "10px 10px 0 0",
          zIndex: 1,
          transform: peekMode
            ? "skewX(0deg)"
            : isTyping || hideEyes
              ? `skewX(${(pp.bodySkew || 0) - 12}deg) translateX(40px)`
              : `skewX(${pp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-700 ease-in-out"
          style={{
            left: peekMode ? 20 : isLookingAtEachOther ? 55 : 45 + pp.faceX,
            top: peekMode ? 35 : isLookingAtEachOther ? 65 : 40 + pp.faceY,
          }}
        >
          <EyeBall
            size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
            isBlinking={isPurpleBlinking}
            forceLookX={peekMode ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={peekMode ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
          <EyeBall
            size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
            isBlinking={isPurpleBlinking}
            forceLookX={peekMode ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
            forceLookY={peekMode ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
          />
        </div>
      </div>

      {/* Black - meio */}
      <div
        ref={blackRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 240,
          width: 120,
          height: 310,
          backgroundColor: "#2D2D2D",
          borderRadius: "8px 8px 0 0",
          zIndex: 2,
          transform: peekMode
            ? "skewX(0deg)"
            : isLookingAtEachOther
              ? `skewX(${(bp.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
              : isTyping || hideEyes
                ? `skewX(${(bp.bodySkew || 0) * 1.5}deg)`
                : `skewX(${bp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-700 ease-in-out"
          style={{
            left: peekMode ? 10 : isLookingAtEachOther ? 32 : 26 + bp.faceX,
            top: peekMode ? 28 : isLookingAtEachOther ? 12 : 32 + bp.faceY,
          }}
        >
          <EyeBall
            size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
            isBlinking={isBlackBlinking}
            forceLookX={peekMode ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={peekMode ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
          <EyeBall
            size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
            isBlinking={isBlackBlinking}
            forceLookX={peekMode ? -4 : isLookingAtEachOther ? 0 : undefined}
            forceLookY={peekMode ? -4 : isLookingAtEachOther ? -4 : undefined}
          />
        </div>
      </div>

      {/* Orange - frente esquerda */}
      <div
        ref={orangeRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 0,
          width: 240,
          height: 200,
          zIndex: 3,
          backgroundColor: "#FF9B6B",
          borderRadius: "120px 120px 0 0",
          transform: peekMode ? "skewX(0deg)" : `skewX(${op.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-8 transition-all duration-200 ease-out"
          style={{
            left: peekMode ? 50 : 82 + (op.faceX || 0),
            top: peekMode ? 85 : 90 + (op.faceY || 0),
          }}
        >
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={peekMode ? -5 : undefined} forceLookY={peekMode ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={peekMode ? -5 : undefined} forceLookY={peekMode ? -4 : undefined} />
        </div>
      </div>

      {/* Yellow - frente direita */}
      <div
        ref={yellowRef}
        className="absolute bottom-0 transition-all duration-700 ease-in-out"
        style={{
          left: 310,
          width: 140,
          height: 230,
          backgroundColor: "#E8D754",
          borderRadius: "70px 70px 0 0",
          zIndex: 4,
          transform: peekMode ? "skewX(0deg)" : `skewX(${yp.bodySkew || 0}deg)`,
          transformOrigin: "bottom center",
        }}
      >
        <div
          className="absolute flex gap-6 transition-all duration-200 ease-out"
          style={{
            left: peekMode ? 20 : 52 + (yp.faceX || 0),
            top: peekMode ? 35 : 40 + (yp.faceY || 0),
          }}
        >
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={peekMode ? -5 : undefined} forceLookY={peekMode ? -4 : undefined} />
          <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" forceLookX={peekMode ? -5 : undefined} forceLookY={peekMode ? -4 : undefined} />
        </div>
        {/* Boca */}
        <div
          className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
          style={{
            left: peekMode ? 10 : 40 + (yp.faceX || 0),
            top: peekMode ? 88 : 88 + (yp.faceY || 0),
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AuthLayoutAnimated — layout split-screen
   Esquerda: personagens | Direita: formulário
   ───────────────────────────────────────────── */
export interface AuthLayoutAnimatedProps {
  children: ReactNode;
  characterState?: CharacterState;
}

export function AuthLayoutAnimated({
  children,
  characterState = {
    isTypingEmail: false,
    isTypingPassword: false,
    showPassword: false,
    hasPassword: false,
  },
}: AuthLayoutAnimatedProps) {
  return (
    <div translate="no" className="min-h-screen grid lg:grid-cols-2 notranslate">
      {/* ═══ Painel esquerdo — personagens ═══ */}
      <div className="relative hidden lg:flex flex-col justify-between bg-gradient-to-br from-foreground/90 via-foreground to-foreground/80 p-12 text-background">
        {/* Logo */}
        <div className="relative z-20">
          <div className="flex items-center gap-2">
            <img
              src={BRAND_LOGO_DARK}
              alt={BRAND_NAME}
              width={76}
              height={28}
              className="h-[28px] w-auto hidden dark:block"
            />
            <img
              src={BRAND_LOGO_LIGHT}
              alt={BRAND_NAME}
              width={76}
              height={28}
              className="h-[28px] w-auto dark:hidden"
            />
          </div>
        </div>

        {/* Personagens animados */}
        <div className="relative z-20 flex items-end justify-center h-[500px]">
          <AnimatedCharacters {...characterState} />
        </div>


        {/* Elementos decorativos */}
        <div className="absolute inset-0 bg-grid-white/[0.03] bg-[size:20px_20px]" />
        <div className="absolute top-1/4 right-1/4 size-64 bg-background/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 size-96 bg-background/5 rounded-full blur-3xl" />
      </div>

      {/* ═══ Painel direito — formulário ═══ */}
      <div className="flex items-center justify-center p-8 bg-background relative">
        {/* Logo mobile */}
        <div className="lg:hidden fixed top-0 left-0 z-10 p-6">
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

        {/* Theme + Language Switcher */}
        <div className="fixed top-0 right-0 z-10 p-6">
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>

        {/* Conteúdo do formulário */}
        <div className="w-full max-w-[420px] space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sentry } from "@/lib/sentry";
import i18n from "i18next";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  boundaryTag?: string;
  /**
   * Quando este valor muda (ex: location.key do React Router),
   * o boundary reseta automaticamente — útil ao navegar entre rotas.
   */
  resetKey?: string | number;
  /**
   * Chamado quando o boundary reseta (auto ou manual).
   * Use para navegar de volta à mesma rota via React Router.
   */
  onReset?: () => void;
  /**
   * Desativa o auto-retry automático de 1 segundo.
   * Use quando onReset faz window.location.reload() para evitar loop infinito
   * (cada reload cria uma nova instância com autoRetried=false).
   */
  disableAutoRetry?: boolean;
  shouldAutoRetryOnError?: (error: Error) => boolean;
  getErrorContext?: (error: Error) => {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  };
}

interface State {
  hasError: boolean;
  error: Error | null;
  prevResetKey?: string | number;
  /** Já tentou o auto-retry? Evita loop infinito. */
  autoRetried: boolean;
  /** Está aguardando o auto-retry (mostra spinner). */
  isAutoRetrying: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;

  state: State = {
    hasError: false,
    error: null,
    prevResetKey: undefined,
    autoRetried: false,
    isAutoRetrying: false,
  };

  /**
   * Reseta automaticamente quando resetKey muda
   * (ex: usuário navega para outra rota).
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (
      state.hasError &&
      props.resetKey !== undefined &&
      props.resetKey !== state.prevResetKey
    ) {
      return {
        hasError: false,
        error: null,
        prevResetKey: props.resetKey,
        autoRetried: false,
        isAutoRetrying: false,
      };
    }
    if (props.resetKey !== state.prevResetKey) {
      return { prevResetKey: props.resetKey };
    }
    return null;
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, isAutoRetrying: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
    const context = this.props.getErrorContext?.(error);
    Sentry.captureException(error, {
      extra: {
        componentStack: info.componentStack,
        ...context?.extra,
      },
      tags: {
        boundary: this.props.boundaryTag ?? "root",
        ...context?.tags,
      },
    });
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    const errorJustOccurred = this.state.hasError && !prevState.hasError;
    const shouldRetryThisError = this.state.error
      ? (this.props.shouldAutoRetryOnError?.(this.state.error) ?? !this.props.disableAutoRetry)
      : !this.props.disableAutoRetry;
    const canAutoRetry = !this.state.autoRetried && shouldRetryThisError;

    if (errorJustOccurred && canAutoRetry) {
      // Aguarda 1s e tenta de novo automaticamente (uma única vez)
      this.setState({ isAutoRetrying: true });
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        this.setState({ autoRetried: true, isAutoRetrying: false });
        this.handleReset();
      }, 1000);
    }
  }

  componentWillUnmount() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
  }

  handleReset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const t = (key: string) => i18n.t(`errorBoundary.${key}`);

      // Auto-retry em andamento: mostra feedback sutil
      if (this.state.isAutoRetrying) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen gap-3 p-8 bg-background">
            <Loader2 className="size-6 text-muted-foreground animate-spin" />
            <p className="text-support text-muted-foreground">{t("retrying")}</p>
          </div>
        );
      }

      // Auto-retry falhou: mostra tela completa
      return (
        <div className="flex items-center justify-center min-h-screen bg-background px-6">
          <div className="flex flex-col gap-4 max-w-md">
            <AlertTriangle className="size-8 text-foreground" />
            <div className="flex flex-col gap-1.5">
              <h1 className="text-xl font-semibold text-foreground tracking-normal">
                {t("title")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("description")}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => window.location.reload()}
              >
                {t("reload")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.history.back()}
              >
                {t("back")}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

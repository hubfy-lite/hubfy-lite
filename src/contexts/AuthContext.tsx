import { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isSamePasswordAsCurrentError } from "@/lib/supabaseAuthErrors";
import { withTimeout } from "@/lib/withTimeout";
import {
  signUp as signUpAction,
  signIn as signInAction,
  signInWithGoogle as signInWithGoogleAction,
  resetPassword as resetPasswordAction,
} from "@/lib/auth-actions";
import { useTheme } from "@/contexts/ThemeContext";
import i18n from "@/i18n";
import { Sentry } from "@/lib/sentry";

type AppRole = "admin" | "tenant" | "customer";

interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  whatsapp: string | null;
  instagram: string | null;
  preferences: {
    theme?: "dark" | "light";
    language?: "pt-BR" | "en";
    default_workspace_id?: string | null;
    [key: string]: unknown;
  } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  profileLoading: boolean;
  roles: AppRole[];
  rolesError: Error | null;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => void;
  signUp: (email: string, name?: string) => Promise<{ data: { session: Session | null; resendStrategy: "supabase" | "edge_function" } | null; error: Error | null }>;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ data: { user: User | null; session: Session | null } | null; error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isTenant: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Module-level utilities (stable references, no re-creation on render)
const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.debug("[auth]", ...args);
  }
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesError, setRolesError] = useState<Error | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  // Marca quando loadUserData já resolveu (mesmo em erro). Impede que ProtectedRoute
  // tome decisões com roles ainda não carregadas (vide bug do redirect no F5 do /superadmin).
  const [rolesResolved, setRolesResolved] = useState(false);
  const rolesAttemptRef = useRef(0);
  // Ref para acessar o user atual dentro do onAuthStateChange (evita stale closure)
  const userRef = useRef<User | null>(null);
  const queryClient = useQueryClient();
  const { hydrateUserTheme, hydratePublicTheme } = useTheme();
  // Refs para acessar as funções de tema dentro de closures (onAuthStateChange)
  const hydrateUserThemeRef = useRef(hydrateUserTheme);
  hydrateUserThemeRef.current = hydrateUserTheme;
  const hydratePublicThemeRef = useRef(hydratePublicTheme);
  hydratePublicThemeRef.current = hydratePublicTheme;
  // Guarda qual userId já teve tema/idioma hidratado neste ciclo de mount (evita fetch duplicado no boot)
  const themeHydratedForRef = useRef<string | null>(null);
  const langHydratedForRef = useRef<string | null>(null);
  const userDataLoadedForRef = useRef<string | null>(null);

  // Mantém ref sincronizado para uso dentro de closures (onAuthStateChange)
  useEffect(() => { userRef.current = user; }, [user]);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error) {
        return data as Profile | null;
      }

      const message = error.message ?? "";
      if (!message.includes("AbortError") || attempt === 1) {
        throw error;
      }

      debug("fetchProfile:retry", { attempt: attempt + 1 });
      await sleep(250);
    }

    return null;
  }, []);

  // Fetch user roles
  const fetchRoles = useCallback(async (userId: string): Promise<AppRole[]> => {
    rolesAttemptRef.current = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      rolesAttemptRef.current = attempt + 1;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error) {
        return (data ?? []).map((row) => row.role as AppRole);
      }

      const message = error.message ?? "";
      if (!message.includes("AbortError") || attempt === 1) {
        throw error;
      }

      debug("fetchRoles:retry", { attempt: attempt + 1 });
      await sleep(250);
    }

    return [];
  }, []);

  // Load user data (roles only)
  const loadUserData = useCallback(async (userId: string) => {
    debug("loadUserData:start", { userId });
    setRolesError(null);
    try {
      const rolesFromDb = await withTimeout(
        fetchRoles(userId),
        8_000,
        "Timeout ao buscar permissões"
      );

      setRoles(rolesFromDb);
      debug("loadUserData:roles", { roles: rolesFromDb });
    } catch (error) {
      console.error("Error loading user data:", error);
      const err = error instanceof Error ? error : new Error(String(error));
      Sentry.captureException(err, {
        tags: {
          feature: "auth",
          operation: "load_user_roles",
          error_kind: err.name ?? "Error",
        },
        extra: {
          auth_source: "load_user_data",
          timeout_ms: 8000,
          route: typeof window !== "undefined" ? window.location.pathname : "",
          user_id: userId,
          retry_count: rolesAttemptRef.current,
        },
      });
      debug("loadUserData:error", error);
      // Sem fallback: expor erro e manter roles vazias. ProtectedRoute mostra
      // tela de retry em vez de conceder role incorreta.
      setRoles([]);
      setRolesError(err);
    } finally {
      // "Resolvido" aqui significa "tentou e terminou" — pode ter erro. A UI
      // distingue loading vs erro via rolesError.
      setRolesResolved(true);
      debug("loadUserData:end");
    }
  }, [fetchRoles]);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    if (!user) return;
    queryClient.setQueryData<Profile | null>(["profile", user.id], (prev) =>
      prev ? { ...prev, ...updates } : prev
    );
  }, [queryClient, user]);

  useEffect(() => {
    debug("init");
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        debug("onAuthStateChange", { event, userId: newSession?.user?.id });

        // Refresh silencioso: mesmo usuário + evento de refresh ou re-emit de SIGNED_IN.
        // O Supabase pode disparar SIGNED_IN ou TOKEN_REFRESHED ao voltar pra aba;
        // em ambos os casos, se é o mesmo user, só atualizamos session/user sem loading.
        const isSameUser = newSession?.user?.id && newSession.user.id === userRef.current?.id;
        const isSilentRefresh =
          isSameUser && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN");

        if (isSilentRefresh) {
          debug("onAuthStateChange:silent-refresh", { event });
          setSession(newSession);
          setUser(newSession!.user);
          return;
        }

        // Eventos que exigem recarregar dados do usuário (login novo, troca de conta, etc.)
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          // NÃO setar fallback roles=["tenant"] aqui — isso envenena o ProtectedRoute
          // pra admin. O loading combinado (rolesResolved) segura a UI até as roles
          // reais chegarem do banco.

          // Hidrata tema em background (não bloqueia liberação inicial da UI)
          if (themeHydratedForRef.current !== newSession.user.id) {
            themeHydratedForRef.current = newSession.user.id;
            void withTimeout(
              hydrateUserThemeRef.current(newSession.user.id),
              3_000,
              "Timeout ao buscar tema"
            ).catch((err) => debug("onAuthStateChange:theme-timeout", err));
          }

          // Evita carregar roles duas vezes no boot (onAuthStateChange + getSession)
          if (userDataLoadedForRef.current !== newSession.user.id) {
            userDataLoadedForRef.current = newSession.user.id;
            void loadUserData(newSession.user.id);
          }
        } else {
          // Logout ou sessão expirada
          setSession(null);
          setUser(null);
          setRoles([]);
          setRolesError(null);
          setRolesResolved(false);
          userDataLoadedForRef.current = null;
          themeHydratedForRef.current = null;
          langHydratedForRef.current = null;
          hydratePublicThemeRef.current();
        }

        setIsInitializing(false);
        debug("isInitializing:false", { source: "onAuthStateChange", event });
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      debug("getSession:start");
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          debug("getSession:error", {
            message: error.message,
            code: (error as { code?: string }).code,
          });
        }

        setSession(session);
        setUser(session?.user ?? null);
        debug("getSession:result", { userId: session?.user?.id });

        if (session?.user) {
          // NÃO setar fallback roles=["tenant"] aqui — o loading combinado
          // (rolesResolved) segura a UI até loadUserData terminar.

          // Hidrata tema em background (não bloqueia boot)
          if (themeHydratedForRef.current !== session.user.id) {
            themeHydratedForRef.current = session.user.id;
            void withTimeout(
              hydrateUserThemeRef.current(session.user.id),
              3_000,
              "Timeout ao buscar tema"
            ).catch((err) => debug("initSession:theme-timeout", err));
          }

          if (userDataLoadedForRef.current !== session.user.id) {
            userDataLoadedForRef.current = session.user.id;
            void loadUserData(session.user.id);
          }
        }
      } catch (error) {
        console.error("Error getting session:", error);
        Sentry.captureException(error, {
          tags: {
            feature: "auth",
            operation: "get_session",
          },
        });
        debug("getSession:exception", error);
      } finally {
        setIsInitializing(false);
        debug("isInitializing:false", { source: "getSession" });
      }
    };

    initSession();

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 300,
  });

  // Hidrata idioma quando o profile é carregado do Supabase
  useEffect(() => {
    if (!user || !profileQuery.data?.preferences) return;
    if (langHydratedForRef.current === user.id) return;
    const dbLang = profileQuery.data.preferences.language;
    if (dbLang === "en" || dbLang === "pt-BR") {
      i18n.changeLanguage(dbLang);
      langHydratedForRef.current = user.id;
    }
  }, [user, profileQuery.data?.preferences]);

  const profile = user
    ? (profileQuery.data ??
        ({
          id: "",
          user_id: user.id,
          name: (user.user_metadata?.name as string | undefined) ?? null,
          avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          bio: null,
          whatsapp: null,
          instagram: null,
          preferences: null,
        } as Profile))
    : null;
  const profileLoading = !!user && profileQuery.isLoading;

  useEffect(() => {
    if (!user) {
      Sentry.setUser(null);
      Sentry.setTags({
        auth_state: "anonymous",
        app_role: "anonymous",
        workspace_id: "none",
      });
      return;
    }

    // Só reporta role real quando o fetch terminou com sucesso. Enquanto não
    // resolve ou em erro, manda "unknown" para não envenenar métricas do Sentry
    // com uma role artificial.
    const appRole =
      !rolesResolved || rolesError || roles.length === 0 ? "unknown" : roles[0];
    const workspaceId =
      (profile?.preferences?.default_workspace_id as string | null | undefined) ?? "none";

    Sentry.setUser({ id: user.id });
    Sentry.setTags({
      auth_state: "authenticated",
      app_role: appRole,
      workspace_id: workspaceId,
    });
  }, [profile?.preferences?.default_workspace_id, roles, rolesError, rolesResolved, user]);

  // Auth actions delegate to standalone module (shared with public auth pages)
  const signUp = (email: string, name?: string) => signUpAction(email, name);
  const signIn = (email: string, password: string) => signInAction(email, password);
  const signInWithGoogle = () => signInWithGoogleAction();

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
    setRolesError(null);
    setRolesResolved(false);
    userDataLoadedForRef.current = null;
    themeHydratedForRef.current = null;
    langHydratedForRef.current = null;
    queryClient.removeQueries({ queryKey: ["profile"] });
    hydratePublicTheme();
  };

  const resetPassword = (email: string) => resetPasswordAction(email);

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: new Error("Usuário não autenticado") };
    }

    // Verify current password by attempting a sign-in
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (verifyError) {
      return { error: new Error("Senha atual incorreta") };
    }

    // Update to the new password
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error && isSamePasswordAsCurrentError(error)) {
      return { error: null };
    }

    return { error };
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  const value: AuthContextType = {
    user,
    session,
    profile,
    profileLoading,
    roles,
    rolesError,
    // loading fica true até (a) a sessão ter sido verificada E (b) se houver user,
    // suas roles terem sido resolvidas do banco. Isso impede que o ProtectedRoute
    // avalie requiredRoles com estado parcial.
    loading: isInitializing || (!!user && !rolesResolved),
    updateProfile,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    hasRole,
    isAdmin: hasRole("admin"),
    isTenant: hasRole("tenant"),
    isCustomer: hasRole("customer"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Standalone auth actions — no React context dependency.
 *
 * These functions are used directly by public auth pages (signup, login,
 * forgot-password) that render OUTSIDE AuthProvider, and also by
 * AuthContext internally (to avoid logic duplication).
 */
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { buildPublicUrl } from "@/lib/public-site-url";
import { withTimeout } from "@/lib/withTimeout";
import { getErrorMessage } from "@/lib/utils";
import i18n from "@/i18n";

export async function signUp(email: string, name?: string) {
  // 1. Pre-check via edge function: classify email and handle upgrades server-side
  try {
    const { data: preCheck } = await invokeEdgeFunction("creator-signup-start", {
      body: { email, name, language: i18n.language, origin: window.location.origin },
    });

    const status = (preCheck as Record<string, unknown>)?.status;

    if (status === "email_taken") {
      return { data: null, error: new Error("EMAIL_ALREADY_EXISTS") };
    }

    if (status === "check_email") {
      // Upgrade path — edge function already sent the email
      return { data: { session: null, resendStrategy: "edge_function" as const }, error: null };
    }

    // status === "proceed_signup" — continue with normal signup below
  } catch (err) {
    // Edge function returned an error with error_code (rate limit, etc.)
    const errorCode = (err as any)._body?.error_code;
    if (errorCode) {
      return { data: null, error: new Error(errorCode) };
    }
    // If edge function is unreachable, fall through to normal signup
    console.warn("[auth] creator-signup-start unreachable, falling through to signUp");
  }

  // 2. Normal new-user signup via Supabase Auth
  const randomPassword = crypto.randomUUID() + "Aa1!";
  const { data, error } = await supabase.auth.signUp({
    email,
    password: randomPassword,
    options: {
      emailRedirectTo: buildPublicUrl("/admin"),
      data: { name, needs_password: true, language: i18n.language, signup_as: "tenant" },
    },
  });

  if (error) {
    return { data: null, error };
  }

  // Supabase fake success (identities=[]) when email already exists
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { data: null, error: new Error("EMAIL_ALREADY_EXISTS") };
  }

  return { data: { session: data.session, resendStrategy: "supabase" as const }, error: null };
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      12_000,
      "Tempo de login esgotado"
    );
    return { data, error };
  } catch (error: unknown) {
    const message = getErrorMessage(error);

    // If the auth request stalls, it may still succeed in the background.
    // As a best-effort fallback, check current session before failing.
    if (message === "Tempo de login esgotado") {
      console.warn("[auth] signIn timeout - checking session as fallback");
      try {
        const { data: sessionData } = await withTimeout(
          supabase.auth.getSession(),
          4_000,
          "Timeout ao verificar sessão"
        );

        const session = sessionData?.session ?? null;
        if (session) {
          return {
            data: { user: session.user ?? null, session },
            error: null,
          };
        }
      } catch (sessionError) {
        console.warn("[auth] getSession fallback failed", sessionError);
      }
    }

    return { data: null, error: error as Error };
  }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/admin`,
    },
  });
  return { error };
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildPublicUrl("/reset-password"),
  });
  return { error };
}

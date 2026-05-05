// Shared email translations — pt-BR, en, es
// Used by: auth-send-email, customer-auth-start, resend-team-invite,
//          resend-customer-invite, add-team-member

export type EmailLanguage = "pt-BR" | "en" | "es";

export function resolveEmailLanguage(
  userMetadata?: Record<string, unknown> | null,
  profilePreferences?: Record<string, unknown> | null,
): EmailLanguage {
  for (const source of [userMetadata?.language, profilePreferences?.language]) {
    if (source === "en") return "en";
    if (source === "es") return "es";
    if (source === "pt-BR") return "pt-BR";
  }
  return "pt-BR";
}

/* ─── Translation strings ─── */

interface CommonStrings {
  greeting: (name: string) => string;
  ignore: string;
  expiry24h: string;
  poweredBy: string;
  via: string;
}

interface AuthSignupStrings {
  subject: string;
  body: string;
  cta: string;
}

interface AuthRecoveryStrings {
  subject: string;
  body: string;
  cta: string;
}

interface AuthEmailChangeStrings {
  subject: string;
  body: string;
  cta: string;
}

interface AuthMagicLinkStrings {
  subject: string;
  body: string;
  cta: string;
}

interface TeamInviteStrings {
  subject: (workspace: string) => string;
  body: (role: string, workspace: string) => string;
  cta: string;
  roleAdmin: string;
  roleEditor: string;
}

interface TeamAccessStrings {
  subject: (workspace: string) => string;
  body: (role: string, workspace: string) => string;
  cta: string;
  roleAdmin: string;
  roleEditor: string;
}

interface CustomerInviteStrings {
  subject: (tenant: string) => string;
  body: (tenant: string) => string;
  body2: string;
  cta: string;
}

interface CustomerAccessStrings {
  subject: (tenant: string) => string;
  body: (tenant: string) => string;
  body2: string;
  cta: string;
}

interface PortalAccessStrings {
  subject: (tenant: string) => string;
  body: (tenant: string) => string;
  cta: string;
  expiryNote: string;
  expiredLink: (loginUrl: string) => string;
  ignoreNote: string;
}

interface CreatorWelcomeStrings {
  subject: string;
  body: string;
  cta: string;
}

export interface EmailTranslations {
  common: CommonStrings;
  signup: AuthSignupStrings;
  recovery: AuthRecoveryStrings;
  emailChange: AuthEmailChangeStrings;
  magicLink: AuthMagicLinkStrings;
  teamInvite: TeamInviteStrings;
  teamAccess: TeamAccessStrings;
  customerInvite: CustomerInviteStrings;
  customerAccess: CustomerAccessStrings;
  portalAccess: PortalAccessStrings;
  creatorWelcome: CreatorWelcomeStrings;
}

/* ─── pt-BR ─── */

const ptBR: EmailTranslations = {
  common: {
    greeting: (name) => (name ? `Olá, ${name}!` : "Olá!"),
    ignore:
      "Se você não esperava este e-mail, pode ignorá-lo com segurança.",
    expiry24h: "Este link expira em 24 horas.",
    poweredBy: "Powered by",
    via: "via",
  },
  signup: {
    subject: "Confirme seu email — Hubfy",
    body: "Obrigado por criar sua conta na Hubfy. Clique no botão abaixo para confirmar seu email e começar a usar a plataforma.",
    cta: "Confirmar email",
  },
  recovery: {
    subject: "Redefinir sua senha — Hubfy",
    body: "Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.",
    cta: "Redefinir senha",
  },
  emailChange: {
    subject: "Confirme seu novo email — Hubfy",
    body: "Recebemos uma solicitação para alterar o email da sua conta. Clique no botão abaixo para confirmar.",
    cta: "Confirmar novo email",
  },
  magicLink: {
    subject: "Seu link de acesso — Hubfy",
    body: "Clique no botão abaixo para acessar sua conta:",
    cta: "Acessar conta",
  },
  teamInvite: {
    subject: (ws) => `Convite para o workspace ${ws}`,
    body: (role, ws) =>
      `Você foi convidado como <strong>${role}</strong> do workspace <strong>${ws}</strong>.<br>Clique no botão abaixo para definir sua senha e acessar o painel.`,
    cta: "Aceitar convite",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  teamAccess: {
    subject: (ws) => `Você foi adicionado ao workspace ${ws}`,
    body: (role, ws) =>
      `Você foi adicionado como <strong>${role}</strong> do workspace <strong>${ws}</strong>.<br>Use seu e-mail e senha para acessar o painel.`,
    cta: "Acessar painel",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  customerInvite: {
    subject: (t) => `Convite para o portal de ${t}`,
    body: (t) =>
      `Você foi convidado para acessar o portal de <strong>${t}</strong>.`,
    body2:
      "Clique no botão abaixo para definir sua senha e acessar seus conteúdos.",
    cta: "Acessar portal",
  },
  customerAccess: {
    subject: (t) => `Você tem acesso ao portal de ${t}`,
    body: (t) =>
      `Você agora tem acesso ao portal de <strong>${t}</strong>.`,
    body2:
      "Use seu e-mail e senha para entrar e acessar seus conteúdos.",
    cta: "Acessar portal",
  },
  portalAccess: {
    subject: (t) => `Seu link de acesso — ${t}`,
    body: (t) =>
      `Clique no botão abaixo para entrar no portal <strong>${t}</strong> e acessar os produtos liberados na sua conta:`,
    cta: "Acessar Portal",
    expiryNote:
      "Este link expira em 24 horas e só pode ser usado uma vez.",
    expiredLink: (url) =>
      `Caso o link tenha expirado, acesse <a href="${url}" style="color: #1a1a1a; text-decoration: underline;">a página de login do portal</a> e solicite um novo.`,
    ignoreNote:
      "Se você não solicitou este acesso, ignore este email.",
  },
  creatorWelcome: {
    subject: "Confirme seu cadastro — Hubfy",
    body: "Clique no botão abaixo para confirmar seu cadastro e acessar o painel.",
    cta: "Confirmar cadastro",
  },
};

/* ─── en ─── */

const en: EmailTranslations = {
  common: {
    greeting: (name) => (name ? `Hi, ${name}!` : "Hi!"),
    ignore:
      "If you didn't expect this email, you can safely ignore it.",
    expiry24h: "This link expires in 24 hours.",
    poweredBy: "Powered by",
    via: "via",
  },
  signup: {
    subject: "Confirm your email — Hubfy",
    body: "Thank you for creating your Hubfy account. Click the button below to confirm your email and get started.",
    cta: "Confirm email",
  },
  recovery: {
    subject: "Reset your password — Hubfy",
    body: "We received a request to reset your account password. Click the button below to create a new password.",
    cta: "Reset password",
  },
  emailChange: {
    subject: "Confirm your new email — Hubfy",
    body: "We received a request to change your account email. Click the button below to confirm.",
    cta: "Confirm new email",
  },
  magicLink: {
    subject: "Your access link — Hubfy",
    body: "Click the button below to access your account:",
    cta: "Access account",
  },
  teamInvite: {
    subject: (ws) => `Invitation to workspace ${ws}`,
    body: (role, ws) =>
      `You've been invited as <strong>${role}</strong> of workspace <strong>${ws}</strong>.<br>Click the button below to set your password and access the dashboard.`,
    cta: "Accept invitation",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  teamAccess: {
    subject: (ws) => `You've been added to workspace ${ws}`,
    body: (role, ws) =>
      `You've been added as <strong>${role}</strong> of workspace <strong>${ws}</strong>.<br>Use your email and password to access the dashboard.`,
    cta: "Access dashboard",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  customerInvite: {
    subject: (t) => `Invitation to ${t}'s portal`,
    body: (t) =>
      `You've been invited to access <strong>${t}</strong>'s portal.`,
    body2:
      "Click the button below to set your password and access your content.",
    cta: "Access portal",
  },
  customerAccess: {
    subject: (t) => `You now have access to ${t}'s portal`,
    body: (t) =>
      `You now have access to <strong>${t}</strong>'s portal.`,
    body2:
      "Use your email and password to sign in and access your content.",
    cta: "Access portal",
  },
  portalAccess: {
    subject: (t) => `Your access link — ${t}`,
    body: (t) =>
      `Click the button below to enter <strong>${t}</strong>'s portal and access the products available in your account:`,
    cta: "Access Portal",
    expiryNote:
      "This link expires in 24 hours and can only be used once.",
    expiredLink: (url) =>
      `If the link has expired, visit <a href="${url}" style="color: #1a1a1a; text-decoration: underline;">the portal login page</a> to request a new one.`,
    ignoreNote:
      "If you didn't request this access, please ignore this email.",
  },
  creatorWelcome: {
    subject: "Confirm your sign-up — Hubfy",
    body: "Click the button below to confirm your sign-up and access the dashboard.",
    cta: "Confirm sign-up",
  },
};

/* ─── es ─── */

const es: EmailTranslations = {
  common: {
    greeting: (name) => (name ? `¡Hola, ${name}!` : "¡Hola!"),
    ignore:
      "Si no esperabas este correo, puedes ignorarlo con seguridad.",
    expiry24h: "Este enlace expira en 24 horas.",
    poweredBy: "Powered by",
    via: "via",
  },
  signup: {
    subject: "Confirma tu email — Hubfy",
    body: "Gracias por crear tu cuenta en Hubfy. Haz clic en el botón de abajo para confirmar tu email y comenzar a usar la plataforma.",
    cta: "Confirmar email",
  },
  recovery: {
    subject: "Restablecer tu contraseña — Hubfy",
    body: "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña.",
    cta: "Restablecer contraseña",
  },
  emailChange: {
    subject: "Confirma tu nuevo email — Hubfy",
    body: "Recibimos una solicitud para cambiar el email de tu cuenta. Haz clic en el botón de abajo para confirmar.",
    cta: "Confirmar nuevo email",
  },
  magicLink: {
    subject: "Tu enlace de acceso — Hubfy",
    body: "Haz clic en el botón de abajo para acceder a tu cuenta:",
    cta: "Acceder a la cuenta",
  },
  teamInvite: {
    subject: (ws) => `Invitación al workspace ${ws}`,
    body: (role, ws) =>
      `Has sido invitado como <strong>${role}</strong> del workspace <strong>${ws}</strong>.<br>Haz clic en el botón de abajo para definir tu contraseña y acceder al panel.`,
    cta: "Aceptar invitación",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  teamAccess: {
    subject: (ws) => `Has sido añadido al workspace ${ws}`,
    body: (role, ws) =>
      `Has sido añadido como <strong>${role}</strong> del workspace <strong>${ws}</strong>.<br>Usa tu email y contraseña para acceder al panel.`,
    cta: "Acceder al panel",
    roleAdmin: "admin",
    roleEditor: "editor",
  },
  customerInvite: {
    subject: (t) => `Invitación al portal de ${t}`,
    body: (t) =>
      `Has sido invitado a acceder al portal de <strong>${t}</strong>.`,
    body2:
      "Haz clic en el botón de abajo para definir tu contraseña y acceder a tus contenidos.",
    cta: "Acceder al portal",
  },
  customerAccess: {
    subject: (t) => `Tienes acceso al portal de ${t}`,
    body: (t) =>
      `Ahora tienes acceso al portal de <strong>${t}</strong>.`,
    body2:
      "Usa tu email y contraseña para entrar y acceder a tus contenidos.",
    cta: "Acceder al portal",
  },
  portalAccess: {
    subject: (t) => `Tu enlace de acceso — ${t}`,
    body: (t) =>
      `Haz clic en el botón de abajo para entrar al portal de <strong>${t}</strong> y acceder a los productos disponibles en tu cuenta:`,
    cta: "Acceder al Portal",
    expiryNote:
      "Este enlace expira en 24 horas y solo puede usarse una vez.",
    expiredLink: (url) =>
      `Si el enlace ha expirado, visita <a href="${url}" style="color: #1a1a1a; text-decoration: underline;">la página de inicio de sesión del portal</a> para solicitar uno nuevo.`,
    ignoreNote:
      "Si no solicitaste este acceso, ignora este correo.",
  },
  creatorWelcome: {
    subject: "Confirma tu registro — Hubfy",
    body: "Haz clic en el botón de abajo para confirmar tu registro y acceder al panel.",
    cta: "Confirmar registro",
  },
};

/* ─── Lookup ─── */

const translations: Record<EmailLanguage, EmailTranslations> = {
  "pt-BR": ptBR,
  en,
  es,
};

export function getEmailTranslations(lang: EmailLanguage): EmailTranslations {
  return translations[lang] ?? translations["pt-BR"];
}

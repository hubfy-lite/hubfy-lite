/**
 * ─── Configuração de Branding ────────────────────────────────────────────────
 *
 * Para substituir o branding da Hubfy pelo seu:
 *
 * 1. Substitua os arquivos em /public/brand/:
 *      - logo-hubfy-dark.svg   → logo para fundo escuro  (tema dark)
 *      - logo-hubfy-light.svg  → logo para fundo claro   (tema light)
 *      - icon-hubfy-dark.svg   → ícone quadrado dark
 *      - icon-hubfy-light.svg  → ícone quadrado light
 *      - avatar-hubfy-dark.webp → avatar/foto do superadmin dark
 *      - avatar-hubfy-light.webp → avatar/foto do superadmin light
 *      - default-tenant-icon.png → ícone fallback de workspace
 *      - favicon-dark.svg      → favicon para tema dark
 *      - favicon-light.svg     → favicon para tema light
 *
 *    Mantenha os mesmos nomes de arquivo OU atualize os caminhos abaixo.
 *
 * 2. Atualize BRAND_NAME com o nome da sua plataforma.
 *
 * 3. No index.html, atualize <title>, <meta name="description"> e os <link rel="icon">.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Nome da plataforma — usado em títulos de página e textos de interface. */
export const BRAND_NAME = "Hubfy";

/** Logo horizontal — versão para fundo escuro (dark mode). */
export const BRAND_LOGO_DARK = "/brand/logo-hubfy-dark.svg";

/** Logo horizontal — versão para fundo claro (light mode). */
export const BRAND_LOGO_LIGHT = "/brand/logo-hubfy-light.svg";

/** Ícone quadrado — versão para fundo escuro. */
export const BRAND_ICON_DARK = "/brand/icon-hubfy-dark.svg";

/** Ícone quadrado — versão para fundo claro. */
export const BRAND_ICON_LIGHT = "/brand/icon-hubfy-light.svg";

/** Avatar do superadmin — versão para fundo escuro. */
export const BRAND_AVATAR_DARK = "/brand/avatar-hubfy-dark.webp";

/** Avatar do superadmin — versão para fundo claro. */
export const BRAND_AVATAR_LIGHT = "/brand/avatar-hubfy-light.webp";

/** Ícone fallback exibido quando um workspace não tem ícone configurado. */
export const BRAND_DEFAULT_TENANT_ICON = "/brand/default-tenant-icon.png";

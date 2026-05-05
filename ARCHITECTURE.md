# Hubfy Lite — Arquitetura & Regras de Negócio
> Documento de referência técnica para o projeto Hubfy Lite (open-source).
---
## Visão Geral
Hubfy Lite é uma plataforma open-source de área de membros para infoprodutores gerenciarem e venderem produtos digitais e cursos online. Baseada na stack React + Vite + Tailwind CSS + TypeScript + Supabase.

**Stack**: React + Vite + Tailwind CSS + TypeScript + Supabase
---
## 1. Multi-Tenancy
- Isolamento por `tenant_id` + Row Level Security (RLS) em todas as tabelas de conteúdo.
- URL pública via slug: `/:slug`.
- Um usuário pode ter múltiplos papéis simultaneamente.
---
## 2. Hierarquia de Papéis

### Camada Global (`user_roles`)
| Role       | Descrição                          |
| ---------- | ---------------------------------- |
| `admin`    | Administrador da instância         |
| `tenant`   | Infoprodutor / dono do negócio     |
| `customer` | Cliente do infoprodutor            |

### Camada Local — Equipe (`tenant_users`)
Apenas membros da equipe de gestão. **Clientes não ficam nessa tabela.**

| Role     | Descrição                              |
| -------- | -------------------------------------- |
| `owner`  | Superadmin do tenant (pode haver mais de 1) |
| `editor` | Colaborador com permissão de edição    |

### Camada Local — Clientes (`customers`)
Tabela dedicada, separada de `tenant_users`. Um cliente pertence a um tenant.

| Campo                    | Tipo              | Descrição                          |
| ------------------------ | ----------------- | ---------------------------------- |
| `tenant_id`              | UUID (FK)         | Tenant ao qual pertence            |
| `user_id`                | UUID (FK)         | Conta no auth.users                |
| `name`                   | TEXT              | Nome do cliente                    |
| `email`                  | TEXT (NOT NULL)   | Email (unique por tenant)          |
| `phone`                  | TEXT              | Telefone                           |
| `city`                   | TEXT              | Cidade                             |
| `region`                 | TEXT              | Estado / região                    |
| `country`                | TEXT              | País                               |
| `total_revenue_cents`    | INTEGER           | Receita total (em centavos)        |
| `mrr_cents`              | INTEGER           | Receita recorrente mensal (centavos) |
| `currency`               | TEXT              | Moeda (ex: `BRL`, `USD`)          |

**RPCs**: `get_tenant_customers`, `update_tenant_customer`, `delete_tenant_customer`
**Edge function**: `add-customer` (cria user no auth + registro em customers)
**Hook**: `useCustomers()` — CRUD completo com React Query
---
## 3. Signup & Workspace

### Signup diferenciado (trigger `handle_new_user`)
O campo `signup_as` nos metadados do usuário define o fluxo:
- **`tenant`** (default): cria perfil → atribui role `tenant`. Não cria tenant automaticamente.
- **`customer`**: cria perfil → atribui role `customer` → insere na tabela `customers` usando o `customer_tenant_id` fornecido nos metadados.
- **`team_member`**: cria perfil → atribui role `tenant` → vincula em `tenant_users` como `editor` no tenant do convite.

### Criação de workspace (`/admin/new-workspace`)
- `ProtectedRoute` redireciona usuários com role `tenant` sem workspace para `/admin/new-workspace`.
- A tela valida slug com debounce consultando somente `tenants`.
- Ao criar workspace, insere em `tenants (name, slug, created_by)`.
- O trigger `handle_new_tenant` cria automaticamente:
  - vínculo owner em `tenant_users`
  - linha default em `tenant_settings`
---
## 4. Modelo de Conteúdo
```
Curso → Módulo → Aula
```
- Curso criado gera **módulo default** automático (trigger `handle_new_course`).
- Slugs auto-gerados.
- Limites de caracteres: nome (200), descrição (300).
- Capas verticais travadas em 4:5 (180×225px).
- Cursos possuem `category` (enum `course_category`) e flags `is_published`.
---
## 5. Sistema de Assets
### Regra XOR (enforced por triggers)
Um asset é **`video` OU `file`**, nunca ambos:
- `validate_asset_file_xor`: impede inserção em `asset_files` se já existe `asset_videos`.
- `validate_asset_video_xor`: impede inserção em `asset_videos` se já existe `asset_files`.
### Ciclo de vida
- Status: `uploading` → `processing` → `ready` | `failed` | `deleted`
- Soft delete via status `deleted` para manter integridade histórica.
### Vínculo com aulas
- Tabela `lesson_assets_link` com `UNIQUE(lesson_id, asset_id)` impede duplicatas.
- Trigger `validate_lesson_asset_tenant` garante que asset e aula pertencem ao mesmo tenant.
### Upload unificado
- Botão único ("Upload arquivos") identifica tipo automaticamente.
- Vídeos → pipeline de hosting de vídeo configurado (`asset-upload-video`).
- Outros formatos → Supabase Storage (`asset-upload-file` + `asset-confirm-upload`).
- Processamento de um arquivo por vez para estabilidade.
- Atualizações otimistas: asset aparece na lista imediatamente.
---
## 6. Storage (Supabase)
| Bucket    | Público | Uso                                              |
| --------- | ------- | ------------------------------------------------ |
| `covers`  | ✅ Sim  | Capas de cursos (vertical/horizontal)             |
| `avatars` | ✅ Sim  | Fotos de perfil e ícones de tenant                |
| `assets`  | ❌ Não  | Arquivos de aula (PDFs, imagens do editor, etc.)  |
### Regras de acesso
- **Capas e avatares**: URL pública direta via `getCoversPublicUrl()`. Sem signed URL.
- **Assets privados**: Signed URLs com TTL de 1 hora. Listagens usam `createSignedUrls` em batch para evitar N+1.
---
## 7. Hospedagem de Vídeo

### Provedor built-in — Gumlet (default)
[Gumlet](https://www.gumlet.com/) é o **provedor de vídeo nativo** do Hubfy Lite. Quando o owner da instância configura o secret `GUMLET_API_KEY`, a plataforma funciona como uma camada white-label sobre o Gumlet: cada workspace recebe um workspace (collection) Gumlet criado automaticamente no primeiro upload, e o tenant gerencia tudo (upload, configurações do player, proteção de vídeo) diretamente no admin panel — sem precisar acessar o dashboard do Gumlet.

Do ponto de vista do tenant, é como se a hospedagem de vídeo fosse nativa da plataforma.

**Secret necessário:** `GUMLET_API_KEY` (configurado pelo owner da instância nas Edge Function Secrets do Supabase).

#### Fluxo de upload (Gumlet)
1. Frontend chama `asset-upload-video`.
2. Edge function cria asset no DB + chama Gumlet API → retorna `asset_id` + `upload_url`.
3. Frontend faz upload direto para Gumlet.
4. Polling via `hosting-poll-progress` (intervalo de 5s) sincroniza `progress_pct`, dimensões, `thumbnail_url` e `playback_url`.
5. Webhook `asset-webhook-hosting` recebe eventos do Gumlet e atualiza status.

#### Proteção de vídeo
- Habilitada via `hosting-enable-video-protection`.
- Tokens de acesso gerados por `hosting-video-token` (signed URLs por visualização).

---

### Integrações externas (por workspace)
Além do Gumlet, cada workspace pode conectar provedores terceiros via `/admin/integrations`. Essas integrações são configuradas individualmente por tenant e não dependem da configuração do owner.

| Provedor | Edge functions |
| -------- | -------------- |
| **PandaVideo** | `pandavideo-connect` / `pandavideo-disconnect` / `pandavideo-list-videos` |
| **Vimeo** | `vimeo-connect` / `vimeo-disconnect` / `vimeo-list-videos` |
| **Wistia** | `wistia-connect` / `wistia-disconnect` / `wistia-list-videos` |
| **Smart Player** | Embed externo via URL |
| **YouTube** | Embed por URL (sem upload) |

#### Fluxo de upload (integrações externas)
1. Frontend chama `asset-upload-video` com o provedor selecionado.
2. Edge function cria asset no DB e retorna `upload_url` conforme o provedor.
3. Frontend faz upload direto ao provedor.
4. Polling e webhook seguem o mesmo padrão (`hosting-poll-progress`, `asset-webhook-hosting`).

### Secrets de vídeo
| Secret | Escopo | Provedor |
| ------ | ------ | -------- |
| `GUMLET_API_KEY` | Instância (owner) | Gumlet (built-in) |
| `GUMLET_SIGNING_SECRET` | Instância (owner) | Verificação de webhooks Gumlet |
| Credenciais do tenant | Por workspace | PandaVideo, Vimeo, Wistia (via `tenant_integrations`) |
---
## 8. Showcases (Vitrines)

### Modelo de acesso
O controle de acesso a conteúdo é **por vitrine**, não por curso individual.

- **Vitrine pública** (`is_public = true`): qualquer customer do tenant acessa automaticamente todos os cursos da vitrine.
- **Vitrine privada** (`is_public = false`): apenas customers listados em `showcase_customers` podem acessar os cursos.

A tabela `showcase_courses` liga vitrines a cursos. A tabela `showcase_customers` controla quem tem acesso a vitrines privadas.

### Função `is_enrolled_in_course()`
Usada em 7 RLS policies (modules, lessons, lesson_progress, lesson_blocks, lesson_assets, lesson_videos, lesson_assets_link). Verifica se o user pode acessar um curso:
1. User está em `showcase_customers` de alguma vitrine que contém o curso, **OU**
2. O curso está em uma vitrine pública e o user é customer do tenant

### Visual
- Configuração visual persistida como colunas: `theme`, `grid_columns` (3-6), `cover_format` (Poster 3:4 ou Banner 16:10).
- Assets visuais: `hero_url`, `bg_dark_url`, `bg_light_url`.
- Função `can_view_showcase` controla visibilidade (editor OR admin OR customer do tenant com vitrine pública ou listado em showcase_customers).
---
## 9. Edge Functions
| Função                     | Descrição                                                  |
| -------------------------- | ---------------------------------------------------------- |
| `add-customer`             | Cria cliente (auth user + registro em customers)           |
| `add-team-member`          | Adiciona membro à equipe do tenant                         |
| `remove-team-member`       | Remove membro da equipe                                    |
| `asset-upload-video`       | Cria asset de vídeo + inicia upload no provedor            |
| `asset-upload-file`        | Gera signed URL para upload de arquivo                     |
| `asset-confirm-upload`     | Confirma upload e marca asset como `ready`                 |
| `asset-delete`             | Remove asset do storage e DB                               |
| `asset-cleanup-orphans`    | Remove assets órfãos                                       |
| `asset-webhook-hosting`    | Recebe webhooks do provedor de vídeo configurado           |
| `hosting-poll-progress`    | Polling de progresso de processamento de vídeo             |
| `hosting-enable-video-protection` | Habilita proteção de vídeo no provedor             |
| `hosting-video-token`      | Gera token de acesso ao vídeo protegido                    |
| `sync-video-settings`      | Sincroniza configurações de vídeo com o provedor           |
| `pandavideo-connect`       | Conecta integração PandaVideo                              |
| `pandavideo-disconnect`    | Desconecta integração PandaVideo                           |
| `pandavideo-list-videos`   | Lista vídeos do PandaVideo                                 |
| `vimeo-connect`            | Conecta integração Vimeo                                   |
| `vimeo-disconnect`         | Desconecta integração Vimeo                                |
| `vimeo-list-videos`        | Lista vídeos do Vimeo                                      |
| `wistia-connect`           | Conecta integração Wistia                                  |
| `wistia-disconnect`        | Desconecta integração Wistia                               |
| `wistia-list-videos`       | Lista vídeos do Wistia                                     |
| `gateway-connect`          | Conecta gateway de pagamento                               |
| `gateway-disconnect`       | Desconecta gateway de pagamento                            |
| `gateway-reprocess`        | Reprocessa transação no gateway                            |
| `gateway-sync`             | Sincroniza dados com o gateway                             |
| `gateway-webhook`          | Recebe webhooks do gateway de pagamento                    |
| `process-checkout`         | Processa checkout: cria order + customer + acesso          |
| `subscribe-free`           | Registra plano gratuito (sem gateway)                      |
| `reconcile-access`         | Reconcilia acessos de customers a vitrines                 |
| `customer-auth-start`      | Envia magic link de acesso ao portal via Resend            |
| `resend-customer-invite`   | Reenvia convite para cliente                               |
| `resend-team-invite`       | Reenvia convite para membro da equipe                      |
| `setup-tenant`             | Setup inicial do tenant                                    |
| `delete-workspace`         | Remove workspace e dados do tenant                         |
| `import-customers-csv`     | Importa clientes via CSV                                   |
| `ai-generate`              | Geração de conteúdo via IA                                 |
| `ai-provider-connect`      | Conecta provedor de IA                                     |
| `ai-provider-disconnect`   | Desconecta provedor de IA                                  |
| `api`                      | API pública da instância                                   |
| `api-key-manage`           | Gerencia chaves de API                                     |
| `seller-submit`            | Submete dados de vendedor                                  |
| `seller-provider-submit`   | Submete dados ao provedor de pagamento                     |
| `seller-upload-document`   | Upload de documentos do vendedor                           |
| `seller-update-webhook`    | Atualiza webhook do vendedor no provedor                   |
| `migrate-lesson-thumbnails`| Migração de thumbnails de aulas                            |
| `creator-signup-start`     | Inicia signup de criador de conteúdo                       |
| `auth-send-email`          | Envio de emails de autenticação customizados               |
---
## 10. Integrações Externas
- **Supabase**: Auth, DB (Postgres), Storage, Edge Functions.
- **Provedores de vídeo**: PandaVideo, Vimeo, Wistia (configurado via `/admin/integrations`).
- **Gateway de pagamento**: Abstração para múltiplos gateways (configurado via `/admin/integrations`).
- **Resend**: Envio de emails transacionais (magic link de acesso ao portal). Remetente configurável via `tenant_settings`.
- **Provedores de IA**: Configurável via `/admin/integrations`.
- **Não há**: OAuth social.
---
## 11. Preferências de UX
- **Capas públicas, conteúdo privado** — sem signed URL para thumbnails/covers.
- **Simplicidade > Over-engineering** — soluções diretas, sem drama.
- **Upload unificado** — botão único que identifica tipo automaticamente.
- **Atualizações otimistas** — assets aparecem na lista imediatamente.
- **Batch over N+1** — listagens usam operações em lote.
- **Player leve no admin** — iframe simples, sem SDK pesado.
- **Idioma**: Português brasileiro (pt-BR) como padrão, inglês (en) como segunda língua. Ver seção 17.
---
## 12. Rotas Principais
### Admin (protegidas, requerem workspace)
| Rota                                              | Página                |
| ------------------------------------------------- | --------------------- |
| `/admin/new-workspace`                            | Criação de workspace  |
| `/admin`                                          | Dashboard             |
| `/admin/courses`                                  | Lista de cursos       |
| `/admin/courses/new`                              | Criar curso           |
| `/admin/courses/:courseId`                        | Estrutura do curso    |
| `/admin/courses/:courseId/modules/new`            | Criar módulo          |
| `/admin/courses/:courseId/modules/:moduleId/lessons/new` | Criar aula    |
| `/admin/courses/:courseId/lessons/:lessonId`      | Editor de aula        |
| `/admin/products`                                 | Produtos              |
| `/admin/products/:productId`                      | Editar produto        |
| `/admin/orders`                                   | Pedidos               |
| `/admin/orders/:orderId`                          | Detalhe do pedido     |
| `/admin/customers`                                | Clientes              |
| `/admin/assets`                                   | Repositório de assets |
| `/admin/showcases`                                | Vitrines              |
| `/admin/integrations`                             | Integrações           |
| `/admin/integrations/vimeo`                       | Integração Vimeo      |
| `/admin/integrations/pandavideo`                  | Integração PandaVideo |
| `/admin/integrations/wistia`                      | Integração Wistia     |
| `/admin/integrations/:provider`                   | Outras integrações    |
| `/admin/design`                                   | Design & Marca        |
| `/admin/settings`                                 | Configurações         |
| `/admin/profile`                                  | Perfil                |
| `/admin/create-seller`                            | Cadastro de vendedor  |
### Públicas
| Rota                       | Página                      |
| -------------------------- | --------------------------- |
| `/:slug`                   | Portal do cliente           |
| `/:slug/store`             | Página pública do tenant    |
| `/:slug/login`             | Login de cliente            |
| `/:slug/forgot-password`   | Recuperação de senha        |
| `/showcases/:slug`         | Showcase público            |
| `/:tenantSlug/:courseSlug` | Showcase do curso           |
| `/:tenantSlug/:courseSlug/:lessonId` | Aula individual   |
---
## 13. Segurança (RLS)
- Todas as tabelas de conteúdo possuem RLS habilitado.
- Funções helper:
  - `is_tenant_customer()` — checa se user é owner/editor (via tenant_users) OU customer (via customers) do tenant
  - `is_tenant_member()` — alias para `is_tenant_customer()` (backward compatibility)
  - `is_tenant_editor()`, `is_tenant_owner()`, `is_admin()`
  - `is_enrolled_in_course()` — checa acesso via showcases (user em showcase_customers OU curso em vitrine pública + user é customer do tenant)
  - `can_view_showcase()` — checa se user pode ver a vitrine
- Customers **nunca** acessam rotas `/admin` (enforced no `ProtectedRoute`).
- Storage: escrita restrita por autenticação + contexto de tenant.
---
## 14. Commerce — Produtos & Pedidos

### Pipeline
```
Produto → Preço → Checkout → Pedido
```

### Tabela `products`
| Campo          | Tipo           | Descrição                                  |
| -------------- | -------------- | ------------------------------------------ |
| `tenant_id`    | UUID (FK)      | Tenant dono                                |
| `name`         | TEXT           | Nome do produto                            |
| `description`  | TEXT           | Descrição                                  |
| `cover_url`    | TEXT           | Capa do produto                            |
| `status`       | ENUM           | `draft`, `active`, `archived` (default: `draft`) |
| `unit_amount`  | INTEGER        | Preço em centavos                          |
| `currency`     | TEXT           | Moeda (default: `BRL`)                     |
| `benefit`      | ENUM           | `files`, `showcase`, `null` — tipo de entrega (imutável após criação) |

**Tabelas junction**:
- `product_assets(product_id, asset_id, sort_order)` — arquivos entregues (máx 10)
- `product_showcases(product_id, showcase_id)` — vitrine de acesso (máx 1)

### Tabela `prices`
| Campo                       | Tipo    | Descrição                              |
| --------------------------- | ------- | -------------------------------------- |
| `product_id`                | UUID    | FK para products                       |
| `category`                  | ENUM    | `one_time`, `subscription`, `lead_magnet` |
| `unit_amount`               | INTEGER | Preço em centavos                      |
| `currency`                  | TEXT    | Moeda                                  |
| `renewal_interval_unit`     | TEXT    | Unidade de recorrência (mês, ano)      |
| `renewal_interval_quantity` | INTEGER | Quantidade de intervalos               |

### Tabela `orders`
| Campo               | Tipo      | Descrição                              |
| ------------------- | --------- | -------------------------------------- |
| `tenant_id`         | UUID      | Tenant                                 |
| `customer_id`       | UUID      | FK para customers                      |
| `product_id`        | UUID      | FK para products                       |
| `price_id`          | UUID      | FK para prices                         |
| `order_number`      | INTEGER   | Número sequencial                      |
| `type`              | ENUM      | `one_time`, `subscription`             |
| `status`            | ENUM      | `pending`, `completed`, `refunded`, `cancelled` |
| `unit_amount`       | INTEGER   | Valor em centavos                      |
| `currency`          | TEXT      | Moeda                                  |
| `idempotency_key`   | TEXT      | Previne pedidos duplicados             |

**Orders são criados exclusivamente pela edge function `process-checkout`.**

### Edge function `process-checkout`
Endpoint público (sem auth), rate-limited por IP.
1. Verifica idempotency key → retorna cache se já existe
2. Valida produto (status `active`, `unit_amount: 0` para free)
3. Find-or-create auth user + registro em `customers`
4. Cria order + incrementa `total_revenue_cents`
5. Se benefit = `showcase`: upsert em `showcase_customers`
6. Dispara `customer-auth-start` (fire-and-forget) — envia magic link de acesso ao portal

### Hooks
- `useProducts()` — CRUD de produtos + gerenciamento de assets e showcases vinculados
- `useOrders()` — Listagem read-only com join de customer + product
- `useOrderDetail(orderId)` — Detalhe de pedido individual
---
## 15. Acesso ao Portal (Magic Link)

### Fluxo
```
Pedido criado → customer-auth-start → Resend API → Email com magic link
                                                     ↓
                                              Cliente acessa portal → produtos liberados
```

### Edge function `customer-auth-start`
- **Dois modos**: AUTO (chamada interna via service_role) e MANUAL (login pelo portal público)
- Modo AUTO: recebe `customer_id` + `tenant_id`, busca customer e tenant, gera magic link, envia email
- Modo MANUAL: recebe `tenant_slug` + `email`, rate-limited (1/min por email, 5/5min por IP), find-or-create auth user
- URL do magic link via `resolvePublicSiteUrl()` (centralizada em `_shared/site-url.ts`)
- Remetente: configurável em `tenant_settings` (`email_sender_name` + domínio verificado no Resend)
- Toggle `enable_sale_emails` em `tenant_settings` controla disparo automático pós-venda

### Secrets
| Secret                        | Uso                                     |
| ----------------------------- | --------------------------------------- |
| `RESEND_API_KEY`              | Autenticação com API Resend             |
---
## 16. Design & Marca do Tenant

### Rota: `/admin/design` (fullscreen, sem sidebar)
Editor visual com preview ao vivo em desktop/mobile.

### Tab Geral — Campos persistidos em `tenant_settings`
- `icon_url` — Ícone quadrado (mín 128×128, máx 512KB)
- `icon_name` — Nome do ícone (fallback quando `icon_url` é nulo). Default: `Rocket`
- `icon_color` — Cor do ícone/avatar. Sincronizado com `primary_color`
- `primary_color` — Cor primária (hex)
- `theme_mode` — `light` ou `dark`

### Preview
- `BrowserChrome` wrapper simulando navegador
- Toggle desktop (820px) / mobile (320px)
- Preview aplica todas as configurações em tempo real
---
## 17. Internacionalização (i18n)

### Setup
- **Biblioteca**: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- **Idiomas**: `pt-BR` (default/fallback), `en`
- **Chave localStorage**: `hubfy.language`
- **Detecção**: localStorage → navegador (browser)
- **Arquivos**: `src/i18n/locales/pt-BR.json`, `src/i18n/locales/en.json`

### Uso
```tsx
const { t } = useTranslation();
// Simples
t("common.save")
// Interpolação
t("courseStructure.moduleCount", { count: 3 })
```

### Regra para novos fluxos
Sempre usar `useTranslation()` e adicionar chaves em **ambos** os arquivos JSON simultaneamente.
---
## 18. Theme (Dark/Light)

### ThemeContext (`src/contexts/ThemeContext.tsx`)
- Gerencia tema `dark | light` com localStorage key `hubfy.theme` (default: `light`)
- `setTheme(next)` — atualização otimista local + persist async em `profiles.preferences.theme` no Supabase
- `hydrateUserTheme(userId)` — ao login, lê tema do Supabase e aplica (com version guard contra races)
- `hydratePublicTheme()` — ao logout, reseta para `light`
- Inline script em `index.html` aplica tema antes do React hidratar (evita flash de tema errado)
- Toggle de classe `dark` no `<html>`

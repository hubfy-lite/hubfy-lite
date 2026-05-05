#!/usr/bin/env node
/**
 * Hubfy — Setup Script
 *
 * Configura um projeto Supabase do zero para o Hubfy.
 * Uso: npm run setup
 */

import readline from "readline";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ─── Cores ───────────────────────────────────────────────────
const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  cyan:    "\x1b[36m",
  gray:    "\x1b[90m",
  white:   "\x1b[97m",
};

// ─── Helpers visuais ─────────────────────────────────────────
const W = 64;

function box(lines, color = c.cyan) {
  const top    = `${color}╔${"═".repeat(W - 2)}╗${c.reset}`;
  const bottom = `${color}╚${"═".repeat(W - 2)}╝${c.reset}`;
  const mid = lines.map((l) => {
    const plain = l.replace(/\x1b\[[0-9;]*m/g, "");
    const pad   = W - 2 - plain.length;
    return `${color}║${c.reset}${l}${" ".repeat(Math.max(0, pad))}${color}║${c.reset}`;
  });
  console.log([top, ...mid, bottom].join("\n"));
}

function divider(char = "─", color = c.gray) {
  console.log(`\n${color}${char.repeat(W)}${c.reset}`);
}

function guide(lines) {
  console.log();
  lines.forEach((l) => console.log(`  ${l}`));
  console.log();
}

const log = {
  ok:   (msg) => console.log(`\n  ${c.green}✅ ${msg}${c.reset}`),
  warn: (msg) => console.log(`  ${c.yellow}⚠️  ${msg}${c.reset}`),
  err:  (msg) => console.error(`\n  ${c.red}✗  ${msg}${c.reset}`),
  info: (msg) => console.log(`  ${c.cyan}ℹ  ${msg}${c.reset}`),
  step: (msg) => console.log(`\n  ${c.bold}${c.cyan}→${c.reset}  ${c.bold}${msg}${c.reset}`),
};

// ─── Helpers de input ─────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) =>
    rl.question(`  ${c.bold}${c.cyan}»${c.reset} ${question} `, (a) => resolve(a.trim()))
  );
}

function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(`  ${c.bold}${c.cyan}»${c.reset} ${question} `);
    let input = "";

    const onData = (buf) => {
      const char = buf.toString();
      if (char === "\n" || char === "\r" || char === "") {
        if (char === "") { process.exit(0); }
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener("data", onData);
        // Não pausar o stdin — o readline precisa continuar recebendo input
        process.stdout.write("\n");
        resolve(input);
      } else if (char === "" || char === "\b") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        input += char;
        process.stdout.write("*");
      }
    };

    process.stdin.resume();
    process.stdin.setRawMode?.(true);
    process.stdin.on("data", onData);
  });
}

async function askUntilValid(rl, { question, secret = false, validate }) {
  while (true) {
    const value = secret
      ? await askSecret(question)
      : await ask(rl, question);

    const error = validate(value);
    if (!error) return value;

    console.log(`\n  ${c.red}✗  Ops! ${error}${c.reset}`);
    console.log(`  ${c.yellow}   Tente novamente ↓${c.reset}\n`);
  }
}

// ─── Supabase Management API ──────────────────────────────────
async function apiFetch(path, pat) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost(path, pat, body, { retries = 3, delayMs = 4000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://api.supabase.com/v1${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API ${path} → ${res.status}: ${text}`);
      }
      return res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      // Aguarda antes de tentar novamente (banco pode ainda estar inicializando)
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ─── Vault via Management API ─────────────────────────────────
async function updateVaultSecrets(projectRef, pat, supabaseUrl, anonKey) {
  const sql = `
    DO $$
    DECLARE _id uuid;
    BEGIN
      SELECT id INTO _id FROM vault.secrets WHERE name = 'supabase_url' LIMIT 1;
      IF _id IS NOT NULL THEN
        PERFORM vault.update_secret(_id, '${supabaseUrl}');
      ELSE
        PERFORM vault.create_secret('${supabaseUrl}', 'supabase_url', 'Supabase project URL for pg_net triggers');
      END IF;

      SELECT id INTO _id FROM vault.secrets WHERE name = 'supabase_anon_key' LIMIT 1;
      IF _id IS NOT NULL THEN
        PERFORM vault.update_secret(_id, '${anonKey}');
      ELSE
        PERFORM vault.create_secret('${anonKey}', 'supabase_anon_key', 'Supabase anon key for pg_net triggers');
      END IF;
    END;
    $$;
  `;
  await apiPost(`/projects/${projectRef}/database/query`, pat, { query: sql });
}

// ─── Executar comando ─────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    execSync(cmd, {
      stdio: opts.silent ? "pipe" : "inherit",
      cwd: ROOT,
      env: { ...process.env, ...(opts.env ?? {}) },
    });
    return true;
  } catch (e) {
    if (opts.optional) {
      log.warn(`Comando opcional falhou: ${cmd}`);
      return false;
    }
    throw e;
  }
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.clear();

  // ── Boas-vindas ───────────────────────────────────────────
  console.log();
  box(
    [
      `  ${c.bold}${c.white}Hubfy — Configuração Inicial${c.reset}`,
      `  ${c.gray}Vamos conectar o Hubfy ao seu banco de dados Supabase.${c.reset}`,
    ],
    c.cyan
  );

  guide([
    `${c.bold}O que este script faz automaticamente:${c.reset}`,
    `  ${c.green}✦${c.reset}  Cria todas as tabelas e estrutura do banco`,
    `  ${c.green}✦${c.reset}  Configura as regras de segurança (RLS)`,
    `  ${c.green}✦${c.reset}  Instala as funções de backend (Edge Functions)`,
    `  ${c.green}✦${c.reset}  Salva as configurações locais automaticamente`,
    ``,
    `${c.bold}Tempo estimado:${c.reset}  ${c.cyan}3 a 5 minutos${c.reset}`,
    `${c.bold}O que você precisa informar:${c.reset}  ${c.cyan}apenas 1 token${c.reset} 🎉`,
  ]);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // ══════════════════════════════════════════════════════════
  //  PASSO 1 — Personal Access Token (PAT)
  // ══════════════════════════════════════════════════════════
  divider("─");
  console.log(`\n  ${c.bold}🔑  Passo 1 de 2  —  Personal Access Token${c.reset}\n`);

  guide([
    `O PAT é um token que dá acesso à sua conta Supabase.`,
    `Com ele, o script busca todas as outras informações automaticamente.`,
    ``,
    `${c.bold}Como gerar:${c.reset}`,
    ``,
    `  1. Acesse:  ${c.cyan}${c.bold}https://supabase.com/dashboard/account/tokens${c.reset}`,
    `  2. Clique em ${c.bold}"Generate new token"${c.reset}`,
    `  3. Dê um nome, ex: ${c.bold}hubfy-setup${c.reset}`,
    `  4. Clique em ${c.bold}"Generate token"${c.reset}`,
    `  5. ${c.yellow}${c.bold}COPIE O TOKEN AGORA!${c.reset} ${c.yellow}Ele só aparece uma vez.${c.reset}`,
    ``,
    `  Parece com isso:  ${c.green}sbp_xxxxxxxxxxxxxxxxxxxx...${c.reset}`,
  ]);

  const pat = await askUntilValid(rl, {
    question: "Cole o token aqui:",
    secret: true,
    validate: (v) => {
      if (!v) return "Campo obrigatório.";
      if (!v.startsWith("sbp_"))
        return 'Token incorreto. Deve começar com "sbp_". Verifique se copiou o token certo.';
      return null;
    },
  });

  // ── Validar PAT buscando os projetos ─────────────────────
  console.log(`\n  ${c.cyan}ℹ  Validando token e buscando seus projetos...${c.reset}`);

  let projects;
  try {
    projects = await apiFetch("/projects", pat);
  } catch (e) {
    log.err("Token inválido ou sem permissão. Verifique e tente novamente.");
    console.log(`  ${c.gray}Detalhe: ${e.message}${c.reset}\n`);
    process.exit(1);
  }

  if (!projects || projects.length === 0) {
    log.err("Nenhum projeto encontrado nesta conta.");
    guide([
      `Crie um projeto em:  ${c.cyan}https://supabase.com/dashboard${c.reset}`,
      `Depois rode novamente:  ${c.bold}npm run setup${c.reset}`,
    ]);
    process.exit(1);
  }

  log.ok(`Token válido! ${projects.length} projeto(s) encontrado(s).`);

  // ══════════════════════════════════════════════════════════
  //  PASSO 2 — Escolher o projeto
  // ══════════════════════════════════════════════════════════
  divider("─");
  console.log(`\n  ${c.bold}📂  Passo 2 de 2  —  Selecione o projeto${c.reset}\n`);

  // Exibir lista de projetos
  const statusLabel = (s) => {
    if (s === "ACTIVE_HEALTHY") return `${c.green}● ativo${c.reset}`;
    if (s === "INACTIVE")       return `${c.gray}● inativo${c.reset}`;
    return `${c.yellow}● ${s?.toLowerCase() ?? "?"}${c.reset}`;
  };

  projects.forEach((p, i) => {
    const num    = `${c.bold}${c.cyan}[${i + 1}]${c.reset}`;
    const name   = `${c.bold}${p.name}${c.reset}`;
    const ref    = `${c.gray}${p.id}${c.reset}`;
    const region = `${c.gray}${p.region ?? ""}${c.reset}`;
    const status = statusLabel(p.status);
    console.log(`  ${num}  ${name}  ${ref}  ${region}  ${status}`);
  });

  console.log();

  let selectedProject;

  if (projects.length === 1) {
    // Só um projeto — confirmar automaticamente
    const p = projects[0];
    const confirm = await ask(rl, `Usar o projeto ${c.bold}${p.name}${c.reset}? (S/n):`);
    if (confirm.toLowerCase() === "n") {
      guide([
        `Crie outro projeto em:  ${c.cyan}https://supabase.com/dashboard${c.reset}`,
        `Depois rode novamente:  ${c.bold}npm run setup${c.reset}`,
      ]);
      rl.close();
      process.exit(0);
    }
    selectedProject = p;
  } else {
    // Múltiplos projetos — pedir número
    selectedProject = await (async () => {
      while (true) {
        const raw = await ask(rl, `Digite o número do projeto (1–${projects.length}):`);
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 1 && n <= projects.length) {
          return projects[n - 1];
        }
        console.log(`\n  ${c.red}✗  Número inválido. Digite um número entre 1 e ${projects.length}.${c.reset}\n`);
      }
    })();
  }

  log.ok(`Projeto selecionado: ${c.bold}${selectedProject.name}${c.reset} (${selectedProject.id})`);

  // ── Buscar credenciais do projeto via API ─────────────────
  console.log(`\n  ${c.cyan}ℹ  Buscando credenciais do projeto automaticamente...${c.reset}`);

  let apiKeys;
  try {
    apiKeys = await apiFetch(`/projects/${selectedProject.id}/api-keys`, pat);
  } catch (e) {
    log.err("Não consegui buscar as chaves do projeto.");
    console.log(`  ${c.gray}Detalhe: ${e.message}${c.reset}\n`);
    process.exit(1);
  }

  const anonKey        = apiKeys.find((k) => k.name === "anon")?.api_key;
  const serviceRoleKey = apiKeys.find((k) => k.name === "service_role")?.api_key;

  if (!anonKey || !serviceRoleKey) {
    log.err("Não encontrei as chaves anon/service_role no projeto. Tente novamente.");
    process.exit(1);
  }

  const projectRef  = selectedProject.id;
  const supabaseUrl = `https://${projectRef}.supabase.co`;

  log.ok("Credenciais obtidas automaticamente!");

  rl.close();

  // ══════════════════════════════════════════════════════════
  //  CONFIGURAÇÃO AUTOMÁTICA
  // ══════════════════════════════════════════════════════════
  divider("═", c.cyan);
  console.log(`\n  ${c.bold}${c.cyan}⚙️  Configurando tudo automaticamente${c.reset}\n`);

  const supabaseEnv = { SUPABASE_ACCESS_TOKEN: pat };

  // ── A: .env.local ─────────────────────────────────────────
  log.step("Salvando configurações locais (.env.local)...");
  fs.writeFileSync(
    path.join(ROOT, ".env.local"),
    `# Gerado por npm run setup em ${new Date().toISOString()}\n` +
    `VITE_SUPABASE_URL=${supabaseUrl}\n` +
    `VITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}\n`,
    "utf8"
  );
  log.ok("Arquivo .env.local criado");

  // ── B: config.toml ────────────────────────────────────────
  log.step("Atualizando configuração do Supabase CLI...");
  const configPath = path.join(ROOT, "supabase", "config.toml");
  let config = fs.readFileSync(configPath, "utf8");
  config = config.replace(/project_id\s*=\s*"[^"]*"/, `project_id = "${projectRef}"`);
  fs.writeFileSync(configPath, config, "utf8");
  log.ok("Configuração atualizada");

  // ── C: Link ───────────────────────────────────────────────
  log.step("Conectando ao projeto Supabase...");
  try {
    run(`npx supabase link --project-ref ${projectRef} --password ""`, {
      silent: true,
      env: supabaseEnv,
    });
    log.ok("Projeto conectado com sucesso");
  } catch {
    log.err("Não consegui conectar. Verifique o PAT e tente novamente.");
    process.exit(1);
  }

  // ── D: Migrations ─────────────────────────────────────────
  log.step("Criando tabelas e estrutura do banco de dados...");
  log.info("Isso pode levar 1-2 minutos. Aguarde...");
  try {
    run("npx supabase db push --linked --yes", { env: supabaseEnv });
    log.ok("Banco de dados configurado — todas as tabelas criadas!");
  } catch {
    log.err("Erro ao criar as tabelas. Verifique a conexão e tente novamente: npm run setup");
    process.exit(1);
  }

  // ── E: Vault ──────────────────────────────────────────────
  log.step("Salvando credenciais no cofre seguro do banco...");
  try {
    await updateVaultSecrets(projectRef, pat, supabaseUrl, anonKey);
    log.ok("Cofre configurado");
  } catch (e) {
    log.warn(`Cofre não configurado: ${e.message}`);
    log.warn("Rode novamente com: npm run setup");
  }

  // ── F: Edge Functions ─────────────────────────────────────
  log.step("Instalando funções de backend (Edge Functions)...");
  log.info("Este passo pode levar alguns minutos. Aguarde...");
  try {
    run(`npx supabase functions deploy --project-ref ${projectRef}`, { env: supabaseEnv });
    log.ok("Funções de backend instaladas!");
  } catch {
    log.warn("Não foi possível instalar as funções automaticamente.");
    log.warn(`Instale manualmente:  npx supabase functions deploy --project-ref ${projectRef}`);
  }

  // ── Concluído! ────────────────────────────────────────────
  divider("═", c.green);
  console.log();
  box(
    [
      `  ${c.bold}${c.green}🎉  Setup concluído com sucesso!${c.reset}`,
      ``,
      `  ${c.bold}Próximos passos:${c.reset}`,
      ``,
      `  1. Rode:   ${c.cyan}npm run dev${c.reset}`,
      `  2. Acesse: ${c.cyan}http://localhost:8080${c.reset}`,
      `  3. Crie sua conta de administrador`,
      `  4. Configure integrações em ${c.cyan}/admin/integrations${c.reset}`,
      ``,
      `  ${c.gray}Dúvidas? Abra uma issue no repositório do projeto.${c.reset}`,
    ],
    c.green
  );
  console.log();
}

main().catch((e) => {
  console.log(`\n  ${c.red}✗  Erro inesperado: ${e.message}${c.reset}`);
  console.log(`  ${c.gray}Tente novamente com: npm run setup${c.reset}\n`);
  process.exit(1);
});

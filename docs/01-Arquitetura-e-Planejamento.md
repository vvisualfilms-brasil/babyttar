# Babyttar — Arquitetura e Planejamento (Fase 0)

> Documento para validação antes do MVP. Nada de código ainda.
> Data: 02/11/2026 · Uso pessoal, não comercial, **custo zero**.

---

## 0. Decisões em uma página

| Tema | Decisão | Por quê |
|---|---|---|
| Formato | **PWA (app web instalável)** | Abre no Safari/Chrome e vira ícone na tela inicial do iPhone e do Android, em tela cheia, funcionando offline. Não precisa de App Store (US$ 99/ano) nem Play Store. |
| Hospedagem | **GitHub Pages** (grátis) | Publicação automática a cada atualização via GitHub Actions. Endereço tipo `seuusuario.github.io/babyttar`. |
| Código | **Vite + React + TypeScript** | Rápido, leve, fácil de manter. |
| Dados e sync | **Repositório privado no GitHub** (`babyttar-dados`) usado como banco, pela API do GitHub | Só uma conta (GitHub). Dados privados, com histórico de versões de tudo. Sincroniza ao abrir o app e a cada ~30 s. |
| Offline | Banco local no aparelho (IndexedDB) + fila de envio | Registra sem internet; envia quando voltar. A tela nunca espera a rede. |
| Acesso | **Token do GitHub** com permissão só para o repositório de dados, colado uma vez em cada celular + nome de quem usa ("Pai", "Mãe") | Sem login a cada uso. |
| Foto do bebê | Comprimida no aparelho (~40 KB) e guardada junto com os dados | Simples e sem custo. |
| Gráficos (fase 2) | Recharts | Leve, bonito no celular. |
| PDF/CSV (fase 2) | Gerados no próprio aparelho (jsPDF + CSV) | Compartilha pelo WhatsApp/e-mail. |
| Percentis OMS (fase 2) | Tabelas oficiais LMS da OMS embutidas no app | Cálculo offline. |

**Dois repositórios.** `babyttar` (público, exigência do Pages grátis) tem só o código do app, sem nenhum dado. `babyttar-dados` (**privado**) guarda os registros. O token fica só nos celulares de vocês, nunca no código.

**Princípio central:** registros originais nunca são sobrescritos sem rastro (edições geram revisão, exclusões vão para a lixeira), e todos os números (médias, totais, tendências) são **calculados a partir deles**, nunca guardados no lugar deles.

---

## 1. Arquitetura

```
┌──────────────────────── CELULAR (pai) — PWA ───────────────────┐
│  Telas (React)                                                  │
│     │                                                           │
│  Camada de domínio  ── regras: duração, meia-noite, médias      │
│     │                                                           │
│  Banco local (IndexedDB) + fila de envio                        │
│  Service worker: app abre sem internet                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ API do GitHub (a cada ~30 s e ao abrir)
┌──────────────────────────▼──── GITHUB: babyttar-dados (privado) ┐
│  devices/pai-xxxx/2026-11.json   ← só o celular do pai grava    │
│  devices/mae-yyyy/2026-11.json   ← só o celular da mãe grava    │
│  histórico de versões de cada arquivo (git)                     │
└──────────────────────────▲──────────────────────────────────────┘
                           │
┌──────────────────────────┴───────── CELULAR (mãe) — PWA ───────┐
│                  mesma estrutura                                │
└─────────────────────────────────────────────────────────────────┘

GitHub (repositório) ──push──► GitHub Actions ──build──► GitHub Pages
                                                      (serve o app)
```

### Camadas do código

```
babyttar/
  src/
    app/                  telas e rotas
    domain/               regras puras e testáveis (sem tela, sem banco)
      time.ts             recorte por dia, meia-noite, fuso
      stats.ts            totais, médias, intervalos, tendências
      events.ts           tipos de atividade e validação
    data/
      local.ts            banco local (IndexedDB)
      github.ts           leitura/gravação na API do GitHub
      sync.ts             fila de envio, junção dos arquivos
      store.ts            estado do app (registros já juntados)
    ui/                   componentes (cards, botões, chips, timer)
  .github/workflows/      publicação automática no Pages
  docs/
```

### Como a sincronização funciona
1. Todo registro nasce com um **ID gerado no celular**. Não depende de internet para existir.
2. Salvou → grava no banco local → tela atualiza na hora → entra na fila de envio.
3. Cada celular grava **somente nos seus próprios arquivos** (`devices/<celular>/<AAAA-MM>.json`, um por mês). Como ninguém grava no arquivo do outro, nunca há briga de gravação.
4. A cada ~30 s (e ao abrir o app) o celular confere se algo mudou no repositório (1 consulta leve) e baixa só os arquivos alterados.
5. **Junção:** o app lê os arquivos de todos os celulares e, para cada registro, fica com a versão mais recente (`updatedAt`). Editar um registro que o outro criou = gravar uma versão nova no seu próprio arquivo. Excluir = gravar uma versão com `deletedAt`.
6. Nada é sobrescrito: as versões antigas continuam nos arquivos e no histórico do git.

### Proteção contra perda de dados
- Exclusão = `deletedAt` preenchido (lixeira, recuperável).
- Toda versão de todo registro fica guardada (arquivos + histórico do git).
- Atualizações do app não tocam nos dados. Mudanças de formato são sempre aditivas, com campo `schemaVersion`.
- O app pede ao navegador armazenamento persistente e oferece exportar backup completo (JSON).
- Se o token vencer, o app continua funcionando offline e avisa para colar um novo; nada se perde.

---

## 2. Mapa de navegação

```
Abertura
 ├─ Primeira vez no celular → dica "Adicionar à Tela de Início"
 ├─ Não configurado → [Conectar ao GitHub]: repositório, token, seu nome
 │                     (ou [Testar só neste aparelho], sem sincronizar)
 │                 └─ Repositório vazio? → [Cadastrar bebê] → nome, nascimento, sexo, foto
 │                    Já tem bebê (o outro responsável cadastrou)? → entra direto
 └─ Configurado → ABAS

ABAS (barra inferior, 4 itens + botão central)
┌────────────┬────────────┬─────(＋)─────┬────────────┬────────────┐
│  Início    │ Histórico  │  Registrar   │ Relatórios │   Bebê     │
└────────────┴────────────┴──────────────┴────────────┴────────────┘

Início (Dashboard)
 ├─ Cabeçalho: foto, nome, idade ("2 meses e 11 dias")
 ├─ Card "Agora": timers ativos (dormindo há 1h12 · mamando 8 min)
 ├─ Grade de botões rápidos (6): Sono · Mamada · Fralda · Tummy · Banho · Remédio
 ├─ Resumo de hoje: mamadas · evacuações · sono · tummy · fraldas
 ├─ Status vitamina D: ✓ dada às 09:10 / ⚠ pendente
 ├─ "Última mamada há 2h05" · "Última fralda há 40 min"
 └─ Últimas atividades (5) → toque abre edição

Registrar (＋) → mesma grade de 6 atividades em folha inferior
 └─ cada atividade → folha de registro rápido (ver seção 4)

Histórico
 ├─ Seletor de dia (← hoje →, calendário)
 ├─ Totais do dia (chips)
 ├─ Filtro por atividade (chips multisseleção)
 ├─ Linha do tempo vertical (hora + ícone + detalhe + quem registrou)
 │    └─ toque → Editar registro (horários, detalhes, excluir)
 └─ [＋ Registro retroativo] → escolhe atividade + data/hora

Relatórios (fase 2; no MVP mostra médias simples de 7 dias)
 ├─ Período: 7d · 30d · 3m · 6m · tudo · [comparar]
 ├─ Rotina: despertar médio, sono, mamadas, evacuações, tummy, fraldas
 ├─ Crescimento: peso, comprimento, perímetro cefálico + curvas OMS
 ├─ Resumo descritivo ("Nesta semana o bebê dormiu em média…")
 └─ Exportar PDF / CSV

Bebê (Perfil)
 ├─ Editar dados e foto
 ├─ Medidas (peso/comprimento) → lista + [nova medida]   (lista no MVP, gráfico na fase 2)
 ├─ Remédios e vitaminas cadastrados (nome, dose padrão, frequência)
 ├─ Sincronização: status, quem usa (Pai/Mãe), trocar token, exportar backup
 └─ Ajustes
```

---

## 3. Banco de dados (arquivos JSON no repositório privado)

```
babyttar-dados/
  devices/
    pai-3f9a/
      2026-11.json
      2026-12.json
    mae-81bc/
      2026-11.json
```

Cada arquivo mensal é uma lista de **versões de registros** gravadas por aquele celular naquele mês. Todo registro tem o mesmo envelope:

| campo | tipo | nota |
|---|---|---|
| col | string | `baby`, `event`, `medication`, `measurement` |
| id | string | gerado no celular |
| updatedAt | número (ms) | decide qual versão vale |
| updatedBy | string | "Pai" / "Mãe" |
| deletedAt | número \| null | lixeira |
| schemaVersion | número | |
| … | | campos da coleção (abaixo) |

Horários guardados como instante absoluto; os dias são recortados no fuso do aparelho.

**baby**
| campo | tipo | nota |
|---|---|---|
| name | string | |
| birthDate | string `AAAA-MM-DD` | (+ `birthTime` opcional) |
| sex | `female` / `male` | usado nas curvas OMS |
| photo | string (imagem comprimida) | ~40 KB |

**medication** — catálogo
| campo | tipo | nota |
|---|---|---|
| name | string | "Vitamina D" |
| defaultDose | number | 2 |
| unit | string | `gotas` / `ml` / `mg` |
| dailyTarget | number \| null | 1 = "1×/dia" → usado no status |
| active | bool | |

**event** — **registros originais**
| campo | tipo | nota |
|---|---|---|
| type | string | `sleep`, `feeding`, `diaper`, `tummy`, `bath`, `medication` |
| kind | string | `interval` (tem duração) ou `point` (pontual) |
| startedAt | número (ms) | obrigatório |
| endedAt | número \| null | null em pontual **ou** atividade em andamento |
| data | objeto | detalhes por tipo (abaixo) |
| note | string \| null | |
| createdBy, createdAt | | quem registrou e quando |

Regras: `endedAt >= startedAt`; no máximo **um** evento em andamento por tipo (o app impede dois timers de sono).

**Conteúdo de `data` por tipo**
| type | kind | data |
|---|---|---|
| sleep | interval | `{ context: "nap" \| "night" }` (sugerido pelo horário, editável) |
| feeding | interval | peito: `{ method: "breast", side: "left"\|"right"\|"both", leftSec, rightSec }` · mamadeira: `{ method: "bottle", volumeMl: 90, milk: "breast_milk"\|"formula" }` |
| diaper | point | `{ pee: true, poop: true, poopCount: 1 }` |
| tummy | interval | `{}` |
| bath | point | `{}` |
| medication | point | `{ medicationId, name: "Vitamina D", dose: 2, unit: "gotas" }` (nome copiado: renomear o remédio não altera o histórico) |

> "Horário que acordou" e "horário que dormiu" **não são eventos separados**: são o fim e o início de um evento `sleep`. Assim o tempo de sono sai automático e o tempo acordado é o intervalo entre um sono e o próximo.

Versões anteriores: continuam nos arquivos mensais e no histórico do git; não precisam de tabela própria.

**measurement** — crescimento
| campo | tipo | nota |
|---|---|---|
| measuredAt | string `AAAA-MM-DD` | |
| weightG | number \| null | gramas (evita erro de vírgula) |
| lengthMm | number \| null | milímetros |
| headMm | number \| null | perímetro cefálico (opcional) |
| source | `home` / `pediatra` | |
| note | | |

Indicadores (médias, totais) **não são gravados** junto dos registros: são calculados na hora a partir deles.

### Segurança
- Repositório de dados **privado**: só a sua conta GitHub acessa.
- Token *fine-grained* com acesso **somente** a esse repositório e **somente** a "Contents" (ler/gravar arquivos). Mesmo se vazar, não mexe em mais nada da sua conta; dá para revogar a qualquer momento.
- O mesmo token é colado nos dois celulares (você passa para a mãe por um canal seu, uma vez).

---

## Regras de cálculo (camada `domain/`)

| Regra | Como será feito |
|---|---|
| Data e horário em tudo | `startedAt` obrigatório; padrão = agora; ajustável. |
| Correção de lançamentos | Qualquer evento editável; gera revisão. |
| Pontual × duração | Campo `kind`. Pontual só tem `startedAt`. |
| **Atravessar meia-noite** | Cada intervalo é **recortado** pelos limites do dia no fuso do bebê. Sono de 22:00 → 03:00 conta 2 h no dia 1 e 3 h no dia 2. Em andamento usa "agora" como fim. |
| Tempo acordado | Intervalo entre o fim de um sono e o início do próximo (janelas de vigília). |
| Horário de despertar do dia | Fim do último sono "noturno" que termina entre 04:00 e 11:00 (faixa ajustável). Média em minutos desde a meia-noite. |
| **Dias sem registro ≠ zero** | Médias dividem pelo número de **dias com pelo menos um registro de qualquer tipo**. Dia vazio é ignorado. Dia com registros mas sem cocô conta como zero cocô. Relatórios mostram "baseado em X de Y dias". |
| Evacuações | Soma de `poopCount` dos eventos de fralda. |
| Vitamina D | Doses do dia ≥ `dailyTarget` → ✓; senão ⚠ pendente. |
| Sem diagnóstico | Textos só descrevem ("dormiu 14h20 em média, 40 min a mais que na semana anterior"). Nunca "normal/anormal". Aviso fixo: "não substitui orientação pediátrica". Percentis OMS mostrados como posição na curva, sem julgamento. |

Funções puras com testes automáticos (meia-noite, horário de verão, dias vazios).

---

## 4. Fluxo de registro de cada atividade

Princípios: **1 toque para começar, no máximo 2–3 para terminar**, horário padrão "agora", chips em vez de teclado, e após salvar aparece um aviso com **[Desfazer]** e **[Ajustar]** por 5 s.

Toda folha de registro tem no topo o seletor de horário: `Agora · −5 min · −15 · −30 · Outro…`

### Sono
```
[Sono] → sem sono ativo:  "Dormiu agora" (1 toque) → timer no card "Agora"
       → com sono ativo:  "Acordou agora" (1 toque) → salva duração
Esqueceu? → [Sono] → "Registrar sono passado" → dormiu às __ / acordou às __
```
Sugestão automática soneca/noite pelo horário (editável).

### Mamada
```
[Mamada] → [Esquerdo] [Direito] [Ambos] [Mamadeira]
  Peito → timer começa na hora
           ├─ [Trocar lado] (soma tempo por lado)
           └─ [Terminar] → salva
           (ou "Já mamou": chips 5 · 10 · 15 · 20 · 30 min)
  Mamadeira → chips 30 · 60 · 90 · 120 · 150 ml (±10)
              → leite materno / fórmula (lembra a última) → [Salvar]
```
Sugere o lado inicial ("última vez: direito").

### Fralda
```
[Fralda] → [Xixi] [Cocô] [Xixi + Cocô] → salva no toque
           cocô: contador +/− para mais de uma evacuação (padrão 1)
```

### Tummy time
```
[Tummy] → timer começa → [Terminar]
          ou "Já fez": chips 2 · 5 · 10 · 15 min
```

### Banho
```
[Banho] → "Banho agora" → salva (1 toque). Ajuste de horário opcional.
```

### Remédio / Vitamina
```
[Remédio] → lista dos cadastrados (Vitamina D no topo, "2 gotas")
            → toque salva com a dose padrão
            → [Ajustar] muda dose ou horário
            → [+ Outro remédio] → nome, dose, unidade, frequência (cadastra uma vez)
```

### Medida de crescimento (no perfil)
```
Bebê → Medidas → [Nova medida] → data (hoje) · peso (kg) · comprimento (cm) · origem → [Salvar]
```

### Editar / excluir / retroativo
```
Histórico → toque no registro → mesma folha preenchida → [Salvar] ou [Excluir] (confirma, vai para lixeira)
Histórico → [＋ Retroativo] → atividade → data/hora → mesma folha
```

---

## Fases de entrega

| Fase | Conteúdo | Resultado |
|---|---|---|
| **0 (este doc)** | Arquitetura, navegação, banco, fluxos | Validação sua |
| **1 — MVP** | Conexão com o GitHub, perfil do bebê com foto e idade, 6 registros rápidos com timers, dashboard, histórico (dias, filtro, editar, excluir, retroativo, totais), sync entre 2 celulares, offline | App no GitHub Pages, instalado nos dois celulares |
| **2** | Relatórios 7d/30d/3m/6m/tudo, comparação de períodos, gráficos, crescimento com curvas e percentis OMS, resumos descritivos, PDF/CSV, backup | App completo |
| **3** | Lembretes (vitamina D), atalhos rápidos, refinamentos | Polimento |

## O que preciso de você antes do MVP
1. **Validar** este documento (ou pedir ajustes).
2. **Conta no GitHub** (se ainda não tiver). O passo a passo para criar os dois repositórios e o token está em `docs/02-Como-publicar-e-instalar.md`.

O MVP pode ser testado no Mac no modo "só neste aparelho" antes de existir qualquer conta.

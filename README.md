# Sistema de Gestão — Casa Personalizada

Documentação completa do projeto: arquitetura, lógica de negócio, estrutura de front-end e back-end (Supabase), e instruções de configuração. Este arquivo serve como referência de instrução para o projeto atual.

---

## 1. Visão Geral

Sistema web de gestão para uma empresa de itens personalizados. Cobre o ciclo completo do negócio: cadastro de clientes, produtos, insumos e fornecedores; registro de pedidos e compras; e um módulo financeiro com balanço mensal, parâmetros de precificação e controle de orçamento de compras.

**Características técnicas:**

- Front-end em **HTML, CSS e JavaScript puro (vanilla)** — sem frameworks, sem build, sem dependências externas além do Chart.js (via CDN, usado só na tela de Relatórios).
- Back-end **100% Supabase**: banco PostgreSQL acessado diretamente via API REST (PostgREST) e autenticação via Supabase Auth.
- Toda a lógica de negócio (cálculos financeiros, rateios, mês contábil) roda **no front-end**. O banco apenas armazena dados brutos.
- Cada página é um arquivo `.html` independente que importa o `shared.js` (núcleo comum) e o `style.css` (estilos unificados).

---

## 2. Arquitetura de Arquivos

| Arquivo | Função |
|---------|--------|
| `index.html` | Tela de **login** (página de entrada do sistema). |
| `relatorio.html` | Dashboard de **Relatórios** — KPIs e gráficos (Chart.js). Destino após login. |
| `pedidos.html` | CRUD de pedidos, com itens (produtos) por pedido e **cálculo de lucro real por venda** (ver 5.10). |
| `clientes.html` | CRUD de clientes. |
| `produtos.html` | CRUD de produtos, incluindo custo e técnica. |
| `insumos.html` | CRUD de insumos, com vínculo a fornecedores e visão de produtos que os usam. |
| `fornecedores.html` | CRUD de fornecedores. |
| `compras.html` | CRUD de compras de insumos, com rateio de transporte. |
| `kanban.html` | Quadro Kanban de tarefas com 5 colunas fixas (status) e drag-and-drop (ver 5.11). |
| `balanco.html` | Balanço mensal: faturamento, CPV, lucro, orçamento de compras, saldo acumulado e aportes. |
| `financeiro.html` | Parâmetros financeiros por mês + calculadora de preço de venda. |
| `shared.js` | Núcleo compartilhado: config Supabase, auth, REST, helpers de formatação, mês contábil e paginação. |
| `style.css` | Folha de estilos unificada de todas as telas. |
| `img/logo.png` | Logo (referenciada como `img/logo.png`, 150×80px). |

> **Nota de limpeza:** existe um arquivo `login.html` que é uma cópia antiga da tela de login (redireciona para `index.html` após autenticar, em vez de `relatorio.html`). O arquivo de login em uso é o `index.html`. O `login.html` pode ser removido para evitar confusão.

### Padrão de cada página protegida

```
1. <link rel="stylesheet" href="style.css">
2. <script src="shared.js"></script>
3. No topo do script da página:
     if (!requireAuth()) throw new Error("redirect");
4. Funções loadAll() / render() / filterData() / openModal() etc.
5. Chamada inicial de carregamento no fim do script.
```

---

## 3. Configuração do Supabase

### 3.1 Credenciais e Endpoints

Definidas no topo do `shared.js`:

```js
const SUPA_URL = 'https://ctueqxlhbtfzvocwohjf.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0dWVxeGxoYnRmenZvY3dvaGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjQyMTMsImV4cCI6MjA5NTE0MDIxM30.VikphOEMgR4QgDOLQkneZWOC2XdgbFvoXyAn1rsDsec'; // chave anon (pública)
```

| Item | Valor |
|------|-------|
| **Project URL** | `https://ctueqxlhbtfzvocwohjf.supabase.co` |
| **anon key** | ver valor completo no bloco de código acima (`SUPA_KEY` no `shared.js`) |

> A **anon key** é pública por design — ela só permite o que as políticas RLS autorizam. A segurança real vem das políticas RLS (ver 3.4), que exigem usuário autenticado para qualquer operação.

### 3.2 Endpoints REST utilizados

Base: `https://ctueqxlhbtfzvocwohjf.supabase.co`

| Endpoint | Uso |
|----------|-----|
| `POST /auth/v1/token?grant_type=password` | Login (e-mail + senha). |
| `POST /auth/v1/logout` | Logout. |
| `GET/POST/PATCH/DELETE /rest/v1/{tabela}` | Operações CRUD nas tabelas (PostgREST). |

**Headers enviados em toda chamada REST** (função `getHeaders()` em `shared.js`):

```js
{
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${access_token || SUPA_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'   // faz o POST/PATCH retornar o registro afetado
}
```

A sintaxe de query do PostgREST é usada diretamente nas URLs, por exemplo:

```
pedidos?select=*&status=eq.Finalizado&data_recebimento=gte.2026-06-05&data_recebimento=lte.2026-07-04&order=id_pedido.desc
```

Operadores comuns no projeto: `eq.` (igual), `gte.`/`lte.` (≥ / ≤), `not.is.null`, `in.(...)`, `order=coluna.asc|desc`, `limit=N`, e embeds (`select=*,produtos(nome)`).

### 3.3 Autenticação

- **Método:** Supabase Auth com e-mail/senha.
- **Cadastro de usuários:** signups **desabilitados** no painel. Usuários são criados manualmente no painel do Supabase (Authentication → Users → Add user), com a opção *Auto Confirm User* marcada.
- **Sessão:** o token retornado pelo login é gravado em `sessionStorage` sob a chave `sb_session`. A sessão vive enquanto a aba estiver aberta.
- **Guarda de rota:** `requireAuth()` no topo de cada página protegida verifica se há sessão válida (e não expirada); se não houver, redireciona para `index.html`.
- **Expiração:** `isTokenExpired()` compara `expires_at` do token com o horário atual. Em `401` durante qualquer chamada REST, a sessão é limpa e o usuário é redirecionado ao login.
- **Pós-login:** redireciona para `relatorio.html`.

### 3.4 Row Level Security (RLS)

**Todas** as tabelas têm RLS habilitado, com uma política única que exige usuário autenticado para qualquer operação:

```sql
ALTER TABLE {tabela} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON {tabela}
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

Ou seja: qualquer usuário **logado** pode ler e escrever tudo; usuários anônimos não acessam nada. Não há segmentação por usuário (o sistema é de uso interno).

---

## 4. Estrutura do Banco de Dados

15 tabelas. Tipos seguem a convenção do Supabase (`int8` = bigint, `float8` = double precision, `uuid` = identificador do Auth). Chaves primárias são `bigserial` (auto-incremento), exceto `usuarios` que usa o `uuid` do Auth.

### 4.1 Diagrama de relacionamentos (resumo)

```
clientes ──< pedidos ──< produto_pedido >── produtos >── insumos ──< insumo_fornecedor >── fornecedores
                                                                                              │
compras >── fornecedores                                                                      │
   │                                                                                          │
   └──< compra_insumo >── insumos ───────────────────────────────────────────────────────────┘

parametros_financeiros (singleton por mês)
custos_fixos / custos_variaveis (listas globais)
aportes (lançamentos no saldo de compras)

usuarios (espelha auth.users) ──< kanban_cards (tarefas do Kanban)
```

### 4.2 Tabelas

#### `clientes`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_cliente | int8 PK | |
| nome | varchar | |
| sobrenome | varchar | |
| telefone | varchar | |
| email | varchar | |
| observacao | varchar | |

#### `fornecedores`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_fornecedor | int8 PK | |
| nome | varchar | |
| site | varchar | |
| telefone | varchar | |
| email | varchar | |
| vendedor | varchar | nome do contato/vendedor |
| telefone_vendedor | varchar | |
| endereco | varchar | |

#### `produtos`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_produto | int8 PK | |
| nome | varchar | |
| preco_unitario | float8 | preço de venda |
| tecnica | varchar | técnica de produção |
| id_insumo | int8 FK → insumos | insumo principal (opcional) |
| custo | float8 | custo do produto (usado no CPV) |
| detalhamento_custo | varchar/text | descrição da composição do custo |

#### `insumos`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_insumo | int8 PK | |
| nome | varchar | |
| quantidade | int8 | estoque (ajustado manualmente) |

#### `insumo_fornecedor` (N:N entre insumos e fornecedores)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_insumo_fornec | int8 PK | |
| id_insumo | int8 FK → insumos | |
| id_fornecedor | int8 FK → fornecedores | |
| preco | float8 | preço daquele insumo naquele fornecedor |
| quantidade | int8 | quantidade/embalagem |
| id_produto_fornecedor | varchar | **código do produto no sistema do fornecedor** (opcional) |

#### `pedidos`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_pedido | int8 PK | |
| valor | float8 | valor total do pedido |
| forma_pagamento | varchar | |
| data_pedido | date | data em que o pedido foi feito |
| data_recebimento | date | **data em que o pagamento foi recebido** (base do faturamento — regime de caixa) |
| status | varchar | `Pendente`, `Finalizado` ou `Cancelado` |
| id_cliente | int8 FK → clientes | |

#### `produto_pedido` (itens de um pedido)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_produto_pedido | int8 PK | |
| id_pedido | int8 FK → pedidos | |
| id_produto | int8 FK → produtos | |
| quantidade | int8 | |
| preco_unitario | float8 | |
| preco_total | float8 | quantidade × preço unitário |

#### `compras`
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_compra | int8 PK | |
| data_compra | date NOT NULL | |
| id_fornecedor | int8 FK → fornecedores, NOT NULL | toda compra tem 1 fornecedor |
| valor_transporte | float8 default 0 | frete/transporte da compra (rateado na exibição) |
| observacao | varchar | |

#### `compra_insumo` (itens de uma compra)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_compra_insumo | int8 PK | |
| id_compra | int8 FK → compras, **ON DELETE CASCADE** | |
| id_insumo | int8 FK → insumos | |
| quantidade | int8 | |
| preco_unitario | float8 | |
| preco_total | float8 | quantidade × preço unitário (sem frete) |

#### `parametros_financeiros` (singleton por mês contábil)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_parametro | int8 PK | |
| faturamento_base | float8 | faturamento de referência do mês |
| taxa_reinvestimento | float8 | em **%** |
| margem_lucro_desejada | float8 | em **%** (opcional, referência) |
| mes_referencia | date, **UNIQUE** | 1º dia do mês contábil (ex: `2026-06-01`) |

#### `custos_fixos` (lista global)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_custo_fixo | int8 PK | |
| nome | varchar | |
| valor | float8 | em **R$** |

#### `custos_variaveis` (lista global)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_custo_variavel | int8 PK | |
| nome | varchar | |
| valor | float8 | em **%** (proporcional ao faturamento) |

> **Importante:** custos fixos são em R$; custos variáveis são em **percentual**. Essa distinção é central na lógica financeira (ver seção 5).

#### `aportes` (lançamentos no saldo de compras)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_aporte | int8 PK | |
| data_aporte | date NOT NULL | define em qual mês contábil o aporte entra |
| valor | float8 default 0 | |
| descricao | varchar | |
| tipo | varchar default `'manual'` | `'manual'` (dinheiro de fora) ou `'lucro'` (transferência do lucro operacional) |

#### `usuarios` (espelha os logins do Auth)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_usuario | uuid PK | mesmo `id` do `auth.users` |
| nome | varchar NOT NULL | nome exibido (ex: como responsável no Kanban) |
| email | varchar | |

> Populada manualmente a partir de `auth.users` (ver 4.4). Não se preenche sozinha.

#### `kanban_cards` (tarefas do Kanban)
| Coluna | Tipo | Notas |
|--------|------|-------|
| id_card | int8 PK | |
| nome | varchar NOT NULL | título da tarefa |
| descricao | text | detalhes (opcional) |
| status | varchar NOT NULL default `'Novo'` | = coluna do quadro: `Novo`, `A fazer`, `Fazendo`, `Bloqueado`, `Finalizado` |
| prioridade | varchar NOT NULL default `'media'` | `baixa`, `media`, `alta`, `urgente` |
| horas_estimadas | float8 default 0 | |
| id_responsavel | uuid FK → usuarios, ON DELETE SET NULL | um responsável por card (opcional) |
| ordem | float8 NOT NULL default 0 | posição dentro da coluna (ver 5.11) |
| criado_em | timestamptz default now() | |

### 4.3 SQL de criação (referência completa)

```sql
-- CLIENTES
CREATE TABLE clientes (
  id_cliente  bigserial PRIMARY KEY,
  nome        varchar, sobrenome varchar,
  telefone    varchar, email varchar, observacao varchar
);

-- FORNECEDORES
CREATE TABLE fornecedores (
  id_fornecedor     bigserial PRIMARY KEY,
  nome varchar, site varchar, telefone varchar, email varchar,
  vendedor varchar, telefone_vendedor varchar, endereco varchar
);

-- INSUMOS
CREATE TABLE insumos (
  id_insumo  bigserial PRIMARY KEY,
  nome       varchar,
  quantidade int8
);

-- PRODUTOS
CREATE TABLE produtos (
  id_produto         bigserial PRIMARY KEY,
  nome               varchar,
  preco_unitario     float8,
  tecnica            varchar,
  id_insumo          int8 REFERENCES insumos(id_insumo),
  custo              float8,
  detalhamento_custo varchar
);

-- INSUMO_FORNECEDOR (N:N)
CREATE TABLE insumo_fornecedor (
  id_insumo_fornec      bigserial PRIMARY KEY,
  id_insumo             int8 REFERENCES insumos(id_insumo),
  id_fornecedor         int8 REFERENCES fornecedores(id_fornecedor),
  preco                 float8,
  quantidade            int8,
  id_produto_fornecedor varchar
);

-- PEDIDOS
CREATE TABLE pedidos (
  id_pedido        bigserial PRIMARY KEY,
  valor            float8,
  forma_pagamento  varchar,
  data_pedido      date,
  data_recebimento date,
  status           varchar,
  id_cliente       int8 REFERENCES clientes(id_cliente)
);

-- PRODUTO_PEDIDO
CREATE TABLE produto_pedido (
  id_produto_pedido bigserial PRIMARY KEY,
  id_pedido         int8 REFERENCES pedidos(id_pedido),
  id_produto        int8 REFERENCES produtos(id_produto),
  quantidade        int8,
  preco_unitario    float8,
  preco_total       float8
);

-- COMPRAS
CREATE TABLE compras (
  id_compra        bigserial PRIMARY KEY,
  data_compra      date NOT NULL,
  id_fornecedor    int8 NOT NULL REFERENCES fornecedores(id_fornecedor) ON DELETE RESTRICT,
  valor_transporte float8 DEFAULT 0,
  observacao       varchar
);

-- COMPRA_INSUMO
CREATE TABLE compra_insumo (
  id_compra_insumo bigserial PRIMARY KEY,
  id_compra        int8 NOT NULL REFERENCES compras(id_compra) ON DELETE CASCADE,
  id_insumo        int8 NOT NULL REFERENCES insumos(id_insumo) ON DELETE RESTRICT,
  quantidade       int8 DEFAULT 0,
  preco_unitario   float8 DEFAULT 0,
  preco_total      float8 DEFAULT 0
);

-- PARAMETROS_FINANCEIROS
CREATE TABLE parametros_financeiros (
  id_parametro          bigserial PRIMARY KEY,
  faturamento_base      float8,
  taxa_reinvestimento   float8,
  margem_lucro_desejada float8,
  mes_referencia        date UNIQUE
);

-- CUSTOS_FIXOS (R$)
CREATE TABLE custos_fixos (
  id_custo_fixo bigserial PRIMARY KEY,
  nome  varchar,
  valor float8
);

-- CUSTOS_VARIAVEIS (%)
CREATE TABLE custos_variaveis (
  id_custo_variavel bigserial PRIMARY KEY,
  nome  varchar,
  valor float8
);

-- APORTES
CREATE TABLE aportes (
  id_aporte   bigserial PRIMARY KEY,
  data_aporte date NOT NULL,
  valor       float8 DEFAULT 0,
  descricao   varchar,
  tipo        varchar DEFAULT 'manual'
);

-- USUARIOS (espelha auth.users)
CREATE TABLE usuarios (
  id_usuario uuid PRIMARY KEY,
  nome       varchar NOT NULL,
  email      varchar
);

-- KANBAN_CARDS
CREATE TABLE kanban_cards (
  id_card          bigserial PRIMARY KEY,
  nome             varchar NOT NULL,
  descricao        text,
  status           varchar NOT NULL DEFAULT 'Novo',
  prioridade       varchar NOT NULL DEFAULT 'media',
  horas_estimadas  float8 DEFAULT 0,
  id_responsavel   uuid REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  ordem            float8 NOT NULL DEFAULT 0,
  criado_em        timestamptz DEFAULT now()
);

-- RLS PARA TODAS AS TABELAS
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clientes','fornecedores','insumos','produtos','insumo_fornecedor',
    'pedidos','produto_pedido','compras','compra_insumo',
    'parametros_financeiros','custos_fixos','custos_variaveis','aportes',
    'usuarios','kanban_cards'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$CREATE POLICY "auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);$f$, t);
  END LOOP;
END $$;
```

### 4.4 Populando a tabela `usuarios`

A tabela `usuarios` espelha os logins do Supabase Auth, mas não se preenche sozinha. Para popular todos os logins existentes de uma vez:

```sql
INSERT INTO usuarios (id_usuario, nome, email)
SELECT id, COALESCE(raw_user_meta_data->>'name', split_part(email,'@',1)), email
FROM auth.users;
```

Isso usa o nome do metadata (se houver) ou a parte antes do `@` do e-mail como nome provisório. Ajuste depois com `UPDATE usuarios SET nome = 'Fulano' WHERE email = '...'`. Ao criar um novo login no painel, insira também a linha correspondente aqui.

---

## 5. Lógica de Negócio

Toda calculada no front-end; o banco não tem triggers nem funções para isso.

### 5.1 Mês Contábil (fechamento dia 5)

O mês contábil **não** coincide com o mês de calendário. Ele fecha no **dia 5**: o mês X vai de **05/X** até **04/(X+1)**.

- Ex: **Junho/2026** = `05/06/2026` a `04/07/2026`.
- Uma venda recebida em `03/07/2026` ainda pertence a **Junho**.

Implementado em `shared.js` com a constante `DIA_FECHAMENTO = 5` e os helpers:

| Função | O que faz |
|--------|-----------|
| `fiscalRange("2026-06")` | retorna `{ inicio: "2026-06-05", fim: "2026-07-04" }` |
| `fiscalMonthOf(data)` | dado um `yyyy-mm-dd` ou `Date`, retorna o mês contábil `"yyyy-mm"` a que pertence |
| `currentFiscalMonth()` | mês contábil atual (`"yyyy-mm"`) |

Para mudar o dia de fechamento, basta alterar `DIA_FECHAMENTO`.

### 5.2 Faturamento — Regime de Caixa

O faturamento do balanço considera apenas pedidos com `status = 'Finalizado'`, filtrados pela **`data_recebimento`** (não pela `data_pedido`) dentro do período contábil. Reconhece a receita quando o dinheiro entra.

- Pedidos finalizados **sem `data_recebimento`** preenchida são **ignorados** até a data ser informada.
- Query: `pedidos?select=...&status=eq.Finalizado&data_recebimento=gte.{inicio}&data_recebimento=lte.{fim}`

### 5.3 CPV (Custo dos Produtos Vendidos)

```
CPV = Σ (produtos.custo × produto_pedido.quantidade)
```
…para os itens dos pedidos finalizados/recebidos no mês.

### 5.4 Reinvestimento e Lucro Operacional

```
Reinvestimento     = faturamento × (taxa_reinvestimento_do_mês / 100)
Custos Variáveis R$ = faturamento × (Σ custos_variaveis% / 100)
Lucro Operacional   = faturamento − CPV − Reinvestimento − Σ custos_fixos(R$) − Custos Variáveis R$
```

- Custos fixos entram em R$; custos variáveis são percentuais aplicados sobre o faturamento.

### 5.5 Capital Disponível para Compras (card hero do Balanço)

```
Capital disponível (próximo mês) = CPV + Reinvestimento
```
Representa o orçamento estimado para reposição de estoque no mês seguinte. É o destaque principal do balanço.

### 5.6 Orçamento de Compras e Saldo Acumulado

O Balanço mostra um card de **Orçamento de Compras** com 4 campos:

| Campo | Significado |
|-------|-------------|
| **Disponível (mês)** | orçamento gerado pelo mês **anterior** = `CPV_anterior + Faturamento_anterior × taxa_reinvest_anterior%` |
| **Já gasto** | soma das compras do mês (itens + transporte) |
| **Saldo acumulado** | "cofrinho" que sobrou de meses anteriores + aportes do mês |
| **Posso gastar** | `(Disponível − Já gasto) + Saldo acumulado` (nunca negativo) |

**Regra do saldo acumulado** (`computeBudget()` em `balanco.html`):
- Percorre todos os meses, em ordem cronológica, desde o primeiro dado (pedido recebido, compra ou aporte) até o mês visualizado.
- A cada mês: `saldo_final = (disponível + saldo_anterior + aportes_do_mês) − gasto`.
- **O saldo nunca fica negativo** — trava em zero. Se o gasto ultrapassa tudo, o excedente vira **"estouro real"** e dispara um alerta vermelho na tela.
- Alertas exibidos: parâmetros do mês anterior não configurados; mês anterior sem pedidos; orçamento estourado.

### 5.7 Rateio do Transporte das Compras

O `valor_transporte` fica só no cabeçalho da compra. Na exibição/somatório, é rateado proporcionalmente ao `preco_total` de cada item:

```
custo_real_item = preco_total + (valor_transporte × preco_total / subtotal_da_compra)
```
Não é gravado no banco — recalcula sempre, então editar frete ou itens reflete na hora.

### 5.8 Aportes e Transferência de Lucro

- **Aporte manual** (`tipo='manual'`): dinheiro de fora lançado no cofrinho. Entra no saldo a partir do mês contábil da `data_aporte`.
- **Transferência de lucro** (`tipo='lucro'`): transfere todo ou parte do lucro operacional do mês para o saldo acumulado. Cria um aporte com descrição automática `"Lucro operacional de {mês}"`. Bloqueia valores acima do lucro disponível.
- No card de Lucro Operacional aparece a linha `↳ R$ X transferido ao saldo` quando há transferência.
- Na lista de aportes, cada item tem tag azul **Manual** ou verde **Lucro**.

### 5.9 Calculadora de Preço (Financeiro)

Sugere o preço de venda que cobre custos e garante o lucro desejado:

```
Preço = Custo do Produto ÷ (1 − Variáveis% − Lucro% − Reinvestimento% − (Fixos ÷ Faturamento))
```

- **Custo do Produto** (R$) e **Lucro Esperado** (%): inputs próprios da calculadora.
- **Variáveis%**: soma dos custos variáveis (já em %).
- **Reinvestimento%**: taxa de reinvestimento do mês.
- **Fixos ÷ Faturamento**: custos fixos (R$) convertidos em % do faturamento base.
- Recalcula automaticamente a cada mudança de qualquer parâmetro da página.
- Se o denominador ≤ 0, mostra "Cálculo inviável" com orientação.

### 5.10 Lucro Real por Venda (Pedidos)

Na tela de Pedidos, ao expandir um pedido, cada produto mostra seu lucro real (% e R$) e o rodapé mostra o lucro total da venda. Tudo calculado na hora, sem coluna nova no banco.

Por item:
```
lucro%_item   = 1 − (custo × qtd / cobrado) − variáveis% − reinvestimento% − (fixos / faturamento_base)
lucro_R$_item = cobrado × lucro%_item
```
Onde `cobrado` = `produto_pedido.preco_total` e `custo` = `produtos.custo`.

Lucro da venda (média ponderada, conforme solicitado):
```
lucro_R$_venda = Σ lucro_R$_item
lucro%_venda   = Σ lucro_R$_item / valor total da venda
```

- **Parâmetros usados:** os do **mês contábil da `data_recebimento`** do pedido (cada venda calculada com a realidade da sua época).
- **Lucro parcial:** se o pedido não tem `data_recebimento`, ou o mês não tem parâmetros financeiros configurados, os componentes ausentes contam como 0% e um aviso amarelo é exibido.
- Como o custo lido é o **atual** de `produtos.custo`, corrigir o custo de um produto recalcula o lucro histórico automaticamente.

### 5.11 Kanban (tarefas)

Quadro de tarefas com **5 colunas fixas que representam o status**: Novo → A fazer → Fazendo → Bloqueado → Finalizado. Não há criação de colunas — as colunas são o próprio status.

- **Card fechado:** nome, selo de prioridade colorido, horas estimadas e avatar (iniciais) do responsável.
- **Modal de detalhes:** nome, descrição, status, responsável (um usuário de `usuarios`), prioridade e horas estimadas.
- **Drag-and-drop:** implementado com pointer events (não a API nativa), para o efeito fluido "pendurado no mouse" com placeholder tracejado. Arrastar entre colunas muda o `status`; dentro da coluna, reordena.
- **Persistência da ordem:** o campo `ordem` é `float8`. Ao soltar um card entre dois outros, a nova ordem é a **média** das ordens vizinhas (ex: entre 1 e 2 → 1.5), então só um card é atualizado por movimento, sem reescrever a coluna inteira.
- As colunas usam `flex: 1` para se ajustarem à largura da tela sem scroll lateral; no mobile empilham em coluna única.

---

## 6. Camada de Acesso a Dados (`supa`)

Toda interação com o banco passa pela função `supa(path, options)`:

```js
// Leitura
const pedidos = await supa('pedidos?select=*&order=id_pedido.desc');

// Inserção (retorna o registro criado por causa do Prefer: return=representation)
const [novo] = await supa('compras', { method: 'POST', body: JSON.stringify(payload) });

// Atualização
await supa(`compras?id_compra=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

// Exclusão
await supa(`compra_insumo?id_compra=eq.${id}`, { method: 'DELETE' });
```

Tratamento de erros embutido: `401` limpa a sessão e redireciona ao login; demais erros lançam `Error` com a mensagem do PostgREST (exibida via `toast`).

---

## 7. Front-end: Padrões de UI

- **Paleta:** sidebar rose `#C0544E`, fundo creme `#F7F0E8`, cards bege `#EDE0D0`, texto `#5C2E28`. Definidas como CSS vars no `:root` do `style.css`.
- **Fontes:** títulos em *Rachelna* (`--font-display`, via cdnfonts), corpo em *Bree Serif* (`--font-body`).
- **Tabelas:** classe base `.data-row` / `.tbl-header` + um modificador de grid por página (`.tbl-pedidos`, `.tbl-clientes`, `.tbl-insumos`, `.tbl-produtos`, `.tbl-fornec`, `.tbl-compras`).
- **Componentes comuns:** modais de cadastro/edição, modal de confirmação de exclusão, toast de feedback, barra de loading no topo, paginação de 15 itens/página.
- **Telas expansíveis** (pedidos, insumos, compras): linha principal `.data-row` dentro de `.order-block`, com `.expand-section` que abre/fecha mostrando detalhes (itens do pedido, fornecedores do insumo, itens da compra).
- **Relatórios:** usa **Chart.js** (CDN) para KPIs e gráficos; o gráfico "Receita por Mês" agrupa por mês contábil e regime de caixa, consistente com o balanço.

---

## 8. Fluxo Operacional Mensal (recomendado)

1. **Início do mês:** em **Financeiro**, selecionar o mês e definir a taxa de reinvestimento, faturamento base e custos (fixos em R$, variáveis em %).
2. **Durante o mês:** cadastrar **pedidos** (marcar `Finalizado` e preencher a `data_recebimento` quando o pagamento entrar) e registrar **compras** conforme acontecem.
3. **Aportes:** se entrar dinheiro de fora ou quiser reinvestir lucro, usar "Adicionar fundos" no Balanço.
4. **Mês seguinte:** o **Balanço** mostra o orçamento de compras já calculado a partir do mês anterior, com o saldo acumulado correto.

> Atenção: como a `data_recebimento` é a base do faturamento, um pedido finalizado sem essa data não aparece no balanço até ser preenchida.

---

## 9. Pontos de Atenção / Manutenção

- **`renderUserBar()`**: função do `shared.js` que monta a barra de usuário/logout na sidebar. Deve ser chamada apenas em páginas cuja estrutura suporta. Chamadas órfãs (sem o elemento esperado) já causaram quebra no carregamento — garantir consistência entre `shared.js` e as páginas.
- **`login.html` duplicado**: remover, mantendo apenas `index.html` como tela de login.
- **Estoque manual**: comprar insumos **não** atualiza `insumos.quantidade` automaticamente — o ajuste é manual.
- **Ambiente de desenvolvimento isolado**: o Supabase só responde a partir do navegador do usuário (o ambiente de geração de código não tem acesso à rede do projeto). Testes de integração devem ser feitos no navegador.
- **Sessão por aba**: como a sessão fica em `sessionStorage`, fechar a aba exige novo login.

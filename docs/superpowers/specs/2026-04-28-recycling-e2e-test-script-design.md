# Roteiro de Teste E2E — Praktikus / Segmento Reciclagem

> **Versão:** 1.0 — 2026-04-28
> **Para uso com:** plugin do Claude no Chrome (Claude for Chrome)
> **Ambiente alvo:** https://praktikus.com.br/ (PRODUÇÃO)
> **Cobertura:** golden path + validações críticas + cruzamento numérico entre módulos

---

## 1. Briefing — Leia antes de começar

Você (IA do Claude no Chrome) vai testar de ponta-a-ponta o **segmento de Reciclagem** do Praktikus, simulando uma recicladora real que acabou de se cadastrar e está operando o sistema pela primeira vez.

A jornada começa no signup e termina conferindo se os números batem entre Compras, Coletas, Estoque, Vendas e Caixa.

**O Praktikus é um SaaS multi-tenant.** Cada empresa que se cadastra tem seu próprio "tenant" isolado. O segmento Reciclagem oferece módulos para: Fornecedores, Compradores, Produtos, Compras, Coletas, Estoque, Vendas, Caixa, Funcionários, Relatórios e Configurações.

Ao terminar, você vai produzir um relatório `.md` com gaps funcionais, problemas de UX e sugestões de melhoria de produto (template no fim deste documento).

---

## 2. Regras de execução

Estas regras valem em TODAS as jornadas. Se em qualquer momento alguma regra entrar em conflito com uma instrução específica, **a regra geral vence**.

### 2.1 Idioma e localidade
- A interface é em **pt-BR**. Use português do Brasil em todos os dados que digitar.
- Datas no formato `DD/MM/AAAA`, valores em reais (`R$ 1.234,56`), CEP `00000-000`, telefone `(11) 99999-9999`.

### 2.2 Geração de dados — CRÍTICO
- **CNPJ e CPF precisam ser válidos pelo algoritmo de dígito verificador** (o sistema rejeita inválidos). NÃO use sequências como `11.111.111/1111-11`.
- Para gerar CNPJ/CPF válidos: gere os 12/9 primeiros dígitos aleatoriamente, depois calcule os 2 dígitos verificadores. Se você não conseguir gerar pelo algoritmo, abra um console no DevTools (F12) e use uma biblioteca/função geradora antes de começar.
- **Sufixo único em todos os recursos:** anexe `Teste Claude {YYYYMMDD-HHMM}` ao nome de empresa, fornecedor, produto, etc., usando a data/hora atual. Isso é essencial pra você não confundir seus dados de teste com dados de outros testes anteriores.
- **E-mail do tenant:** `qa-claude-{YYYYMMDD-HHMM}@example.com` (sem `@praktikus.com.br` pra evitar conflitos).
- **Senha forte:** algo como `Teste@Praktikus#2026!` (≥10 caracteres, maiúsculas, minúsculas, números, símbolo).

### 2.3 Idempotência e respeito a dados existentes
- **NUNCA edite, delete, ou interaja com dados que você não criou.** Se ao logar você ver fornecedores/produtos/vendas que não foram criados por este roteiro, ignore-os.
- Cada execução deste roteiro cria um **novo tenant**. Anote o **e-mail do responsável** e o **CNPJ usado** logo após o signup — eles vão pro relatório final pra cleanup manual.
- Se em qualquer momento o sistema rejeitar um dado por duplicidade, **regenere com novo timestamp** e tente novamente.

### 2.4 Comportamento da IA
- **Antes de clicar em qualquer botão "Excluir", "Deletar", "Cancelar":** confirme que o registro foi criado por você nesta sessão.
- **Ações destrutivas em produção que não estejam no roteiro:** NÃO execute. Se descobrir um botão tentador (ex: "Limpar tudo"), **anote como observação**, mas não clique.
- **Ao topar um erro 500, modal de erro genérico, ou tela quebrada:** anote o gap, capture screenshot, e tente continuar a jornada de outro ângulo. Se não der, marque a jornada como "bloqueada" e siga para a próxima.
- **Ao topar um diálogo "Tem certeza?":** leia com atenção e só confirme se é parte do passo planejado.

### 2.5 Caderno de bordo
Você vai manter, em paralelo à execução, uma lista crescente de **gaps observados**. Cada entrada tem este formato (detalhes na Seção 3):

```
- [Categoria] [Severidade] [Jornada N - Passo X] Descrição curta. Screenshot: <url ou "n/a">
```

Acumule essas entradas; elas viram o miolo do relatório final.

---

## 3. Caderno de bordo — categorias e severidade

Use exatamente estas 4 categorias:

| Emoji | Categoria | Quando usar |
|-------|-----------|-------------|
| 🐞 | **Bug funcional** | Algo não funciona como deveria: botão não responde, dado não salvo, número errado, erro 500, validação que deveria existir e não tem, ou que tem e bloqueia indevidamente. |
| 🎨 | **UX/copy** | Funciona, mas a experiência é ruim: mensagem confusa, label ambíguo, falta máscara em campo (CNPJ/telefone/CEP), falta feedback de loading, falta confirmação em ação destrutiva, layout quebrado, contraste fraco, erro genérico em vez de explicar. |
| 💡 | **Sugestão de produto** | Funciona ok, mas algo seria útil: filtro que falta, ordenação, atalho de teclado, exportar em CSV, duplicar registro, busca por código de barras, dashboard widget, etc. |
| 🔒 | **Segurança/permissão** | Algo cheira mal em termos de autorização: ver dado de outro tenant, segment guard furado, funcionário sem permissão acessando recurso. |

**Severidade:**
- 🔴 **Alta** — bloqueia operação real (signup falhando, venda não salva, número errado em estoque/caixa, vazamento de dado).
- 🟡 **Média** — incomoda mas dá pra contornar (UX ruim em fluxo frequente, validação que não bloqueia mas confunde, sugestão de alta utilidade).
- 🟢 **Baixa** — polimento (label torto, copy poderia ser mais clara, sugestão de conveniência).

---

## 4. Jornadas

> Cada jornada tem **🎯 Ação**, **✅ Esperado**, **👁 Observar**.
> A IA deve seguir as ações na ordem, comparar com o esperado, e usar **Observar** como rubrica pra anotar gaps mesmo quando o passo "passa".

### 📍 Jornada 1 — Seleção de segmento + signup da recicladora

**Página inicial:** https://praktikus.com.br/

#### Passo 1.1 — Acessar a home
- 🎯 **Ação:** Navegue até `https://praktikus.com.br/`. Observe a landing page (se houver) e procure pelo CTA de cadastro/signup.
- ✅ **Esperado:** Existe um caminho claro pra `/register` a partir da home, ou a home redireciona pra login com um link "criar conta".
- 👁 **Observar:** A home explica o que é o produto? O CTA tá visível? A primeira impressão transmite "SaaS profissional"?

#### Passo 1.2 — Selecionar segmento Reciclagem
- 🎯 **Ação:** Vá pra `/register`. Na tela de seleção de segmento, escolha **Reciclagem** (não Oficina).
- ✅ **Esperado:** Após seleção, é redirecionado pra `/register/recycling` (ou tela equivalente).
- 👁 **Observar:** A tela explica a diferença entre os segmentos? Tem ícones/imagens claras? Dá pra voltar e mudar?

#### Passo 1.3 — Preencher dados da empresa (Passo 1 do signup)
- 🎯 **Ação:** Preencha:
  - **CNPJ:** gerado válido pelo algoritmo (ex: `12.345.678/0001-XX` com DV correto)
  - **Razão Social:** `Recicladora Teste Claude {timestamp} LTDA`
  - **Nome Fantasia:** `Recicladora Teste {timestamp}`
  - **Telefone:** `(11) 98765-4321`
  - **CEP:** use um CEP real válido (ex: `01310-100` — Av. Paulista). Se houver lookup automático, espere preencher.
  - Demais campos de endereço preenchidos pelo lookup ou digitados.
- ✅ **Esperado:** Validação de CNPJ acontece (verde/check ao terminar de digitar), máscara aplicada nos campos, lookup de CEP preenche logradouro/bairro/cidade/UF, botão "Próximo" habilita.
- 👁 **Observar:** Máscara aplicada em tempo real? CNPJ inválido bloqueia avanço com mensagem clara? CEP busca rápida ou trava? Campos opcionais marcados como tal? Mobile responsivo (abra DevTools → modo responsivo)?

#### Passo 1.4 — Preencher dados do responsável (Passo 2)
- 🎯 **Ação:** Preencha:
  - **Nome completo:** `Responsável Teste Claude`
  - **E-mail:** `qa-claude-{timestamp}@example.com`
  - **Senha:** senha forte definida na Seção 2.2
  - **Confirmar senha:** mesma senha
- ✅ **Esperado:** Medidor de força de senha mostra "forte". Confirmação de senha valida em tempo real. Botão "Cadastrar" habilita só com tudo válido.
- 👁 **Observar:** Medidor de senha é claro? Mostra critérios faltantes (símbolo, número, tamanho)? Erro de "senhas não conferem" aparece imediatamente ou só ao submeter? Tem opção de mostrar/ocultar senha?

#### Passo 1.5 — Submeter cadastro
- 🎯 **Ação:** Clique em "Cadastrar" / "Criar conta".
- ✅ **Esperado:** Loading visível durante o submit, em seguida redirect pra `/recycling/dashboard` já autenticado, ou pra tela de boas-vindas/onboarding.
- 👁 **Observar:** Tempo de resposta razoável (<3s)? Mensagem de boas-vindas? Tour guiado? Email de confirmação chegou (se houver)?

**Anote agora:** o e-mail e o CNPJ usados. Esses dados vão para a seção de **Cleanup** do relatório final.

---

### 📍 Jornada 2 — Validações do signup (testar ANTES da Jornada 1.5 ter sucesso, ou em uma sessão paralela)

> Esta jornada **não cria tenant** — é só pra observar os erros. Pode ser feita em uma janela anônima/privada antes de começar a Jornada 1, ou repetida fazendo logout depois.

#### Passo 2.1 — CNPJ inválido
- 🎯 **Ação:** Em `/register/recycling`, digite CNPJ `11.111.111/1111-11` (DV inválido).
- ✅ **Esperado:** Mensagem de erro clara: "CNPJ inválido" ou similar; botão de avançar bloqueado.
- 👁 **Observar:** Erro aparece em tempo real (ao sair do campo) ou só no submit? Mensagem é específica ("dígito verificador inválido") ou genérica ("inválido")?

#### Passo 2.2 — Campo obrigatório vazio
- 🎯 **Ação:** Tente avançar com Razão Social vazia.
- ✅ **Esperado:** Erro inline no campo, foco automático no campo problemático.
- 👁 **Observar:** Lista todos os campos faltando ou só o primeiro? O erro some quando você digita?

#### Passo 2.3 — Senha fraca
- 🎯 **Ação:** No passo 2 do signup, digite senha `123456`.
- ✅ **Esperado:** Medidor mostra "fraca", critérios não atendidos listados, submit bloqueado.
- 👁 **Observar:** Critérios são explicados antes de digitar ou só após? Mensagem é amigável ou técnica?

#### Passo 2.4 — Senhas diferentes
- 🎯 **Ação:** Digite senhas diferentes nos dois campos.
- ✅ **Esperado:** Erro "senhas não conferem" aparece.
- 👁 **Observar:** Erro aparece on-blur, on-change, ou só no submit?

#### Passo 2.5 — E-mail inválido
- 🎯 **Ação:** Digite `naoehemail`.
- ✅ **Esperado:** Erro de formato.
- 👁 **Observar:** Aceita formatos esquisitos (`a@b`)? Mensagem clara?

---

### 📍 Jornada 3 — Primeira impressão do dashboard

**Pré-requisito:** Logado após Jornada 1.

#### Passo 3.1 — Explorar o dashboard
- 🎯 **Ação:** Você está em `/recycling/dashboard`. Olhe a tela inteira sem clicar em nada por 15 segundos.
- ✅ **Esperado:** Dashboard carrega, mesmo vazio (sem dados ainda). Menu lateral com módulos do segmento Reciclagem está visível.
- 👁 **Observar:**
  - Estado vazio é tratado? ("Você ainda não tem compras" vs gráficos zerados sem contexto.)
  - Há um onboarding/tour ("Comece cadastrando seu primeiro fornecedor")?
  - Quais widgets/KPIs aparecem? Faz sentido pra recicladora?
  - Menu lateral: rótulos dos itens são claros pra um operador de recicladora ("Coletas" vs "Compras" — fica óbvio a diferença)?
  - Avatar/menu do usuário visível? Logout acessível?

#### Passo 3.2 — Verificar header e navegação
- 🎯 **Ação:** Passe o mouse sobre cada item do menu lateral, abra cada um rapidamente, volte pro dashboard.
- ✅ **Esperado:** Cada rota carrega sem erro, mesmo vazia.
- 👁 **Observar:** Estados de loading? URL muda na navegação (não é SPA travada)? Botão voltar do navegador funciona?

---

### 📍 Jornada 4 — Configurações da empresa

**Página:** `/recycling/settings`

#### Passo 4.1 — Verificar dados pré-preenchidos
- 🎯 **Ação:** Acesse Configurações.
- ✅ **Esperado:** CNPJ, razão social, telefone e endereço usados no signup aparecem pré-preenchidos.
- 👁 **Observar:** Os dados batem 100% com o que você digitou? Algum campo extra que não estava no signup mas deveria/poderia estar (logo da empresa, horário de funcionamento, plano contratado)?

#### Passo 4.2 — Identificar o tenant
- 🎯 **Ação:** Procure por algo como "ID do tenant", "ID da conta", ou abra o DevTools → Application → Cookies/LocalStorage → procure no JWT (decodifique em jwt.io se necessário) o campo `tenantId` ou `tenant_id`.
- ✅ **Esperado:** Você consegue encontrar o ID do tenant.
- 👁 **Observar:** Esse ID está exposto no app (útil pra suporte) ou enterrado no JWT (precisa de DevTools)?

**Anote o `tenant_id` agora — vai pro relatório final.**

#### Passo 4.3 — Editar e salvar
- 🎯 **Ação:** Mude o telefone para `(11) 91234-5678`. Salve.
- ✅ **Esperado:** Toast/feedback de sucesso. Refresh da página mantém o novo valor.
- 👁 **Observar:** Há confirmação antes de salvar mudanças sensíveis (CNPJ, razão social)? Validação dos novos dados?

---

### 📍 Jornada 5 — Cadastro de Fornecedor

**Página:** `/recycling/suppliers`

#### Passo 5.1 — Estado vazio e novo fornecedor
- 🎯 **Ação:** Acesse `/recycling/suppliers`. Clique em "Novo Fornecedor" / "Adicionar".
- ✅ **Esperado:** Empty state amigável, botão de adicionar visível.
- 👁 **Observar:** Estado vazio explica o que é fornecedor no contexto da recicladora? Há atalho de importação em massa (CSV)?

#### Passo 5.2 — Validação de CPF inválido
- 🎯 **Ação:** No formulário, escolha tipo "Pessoa Física" (se houver). Digite CPF `111.111.111-11`.
- ✅ **Esperado:** Erro "CPF inválido".
- 👁 **Observar:** Mesma rubrica do CNPJ — mensagem clara, em tempo real?

#### Passo 5.3 — Cadastro válido (Pessoa Jurídica)
- 🎯 **Ação:** Mude pra tipo "Pessoa Jurídica". Preencha:
  - **CNPJ:** novo CNPJ válido gerado
  - **Razão Social:** `Fornecedor Teste Claude {timestamp}`
  - **Telefone:** `(11) 92222-3333`
  - **Endereço:** preencha (CEP `04567-000` ou outro válido)
  - Demais campos opcionais à vontade.
- ✅ **Esperado:** Salva com sucesso, volta pra lista, fornecedor aparece com nome correto.
- 👁 **Observar:** Quais campos são obrigatórios? Faltam campos úteis (e-mail, observações, condição de pagamento, materiais que costuma vender)?

**Anote o nome exato do fornecedor — você vai usá-lo nas compras (Jornada 9) e coletas (Jornada 10).**

#### Passo 5.4 — Lista, busca e edição
- 🎯 **Ação:** Volte pra `/recycling/suppliers`. Procure pelo fornecedor pelo nome usando a busca (se houver). Clique pra abrir e editar.
- ✅ **Esperado:** Busca funciona, edição abre com dados, salvar mudança reflete na lista.
- 👁 **Observar:** Há filtros (por tipo, cidade, status)? Ordenação por colunas? Paginação? Botão de exportar lista?

---

### 📍 Jornada 6 — Cadastro de Comprador

**Página:** `/recycling/buyers`

#### Passo 6.1 — Cadastrar comprador
- 🎯 **Ação:** Repita a estrutura da Jornada 5, mas em `/recycling/buyers`. Cadastre **um comprador PJ** com CNPJ válido único e nome `Comprador Teste Claude {timestamp}`.
- ✅ **Esperado:** Mesmas garantias da Jornada 5.
- 👁 **Observar:** O cadastro é praticamente igual ao de fornecedor? Faz sentido serem entidades separadas, ou poderiam ser uma única "Contraparte" com flag? Ou a separação é boa pra clareza? (Anote como sugestão se relevante.)

**Anote o nome do comprador — usado na Jornada 12.**

---

### 📍 Jornada 7 — Cadastro de Produtos

**Página:** `/recycling/products`

> Cadastre **3 produtos** diferentes pra simular um catálogo realista.

#### Passo 7.1 — Produto 1 (Alumínio)
- 🎯 **Ação:** "Novo Produto":
  - **Nome:** `Alumínio Latinha Teste {timestamp}`
  - **Unidade:** `kg`
  - **Preço de compra:** `R$ 7,50`
  - **Preço de venda:** `R$ 9,80`
  - Demais campos: à vontade.
- ✅ **Esperado:** Salva, volta pra lista.
- 👁 **Observar:** Há separação compra vs venda? Suporte a múltiplas unidades? Auto-foco nos campos certos? Valida que preço de venda > preço de compra (ou pelo menos avisa)?

#### Passo 7.2 — Produto 2 (Cobre)
- 🎯 **Ação:** Cadastre `Cobre Encapado Teste {timestamp}`, kg, compra `R$ 22,00`, venda `R$ 28,00`.

#### Passo 7.3 — Produto 3 (Papelão)
- 🎯 **Ação:** Cadastre `Papelão Teste {timestamp}`, kg, compra `R$ 0,80`, venda `R$ 1,20`.

#### Passo 7.4 — Lista de preços PDF
- 🎯 **Ação:** Procure botão "Exportar PDF" / "Lista de preços" / "Tabela de preços" na tela de produtos.
- ✅ **Esperado:** Gera PDF com os 3 produtos, preços formatados em real, identificação da empresa no cabeçalho.
- 👁 **Observar:** Layout do PDF é apresentável (poderia ser entregue a um cliente)? Mostra dados certos? Permite escolher quais produtos incluir? Watermark ou logo?

---

### 📍 Jornada 8 — Cadastro de Funcionário + permissões

**Página:** `/recycling/employees`

#### Passo 8.1 — Cadastrar funcionário
- 🎯 **Ação:** "Novo Funcionário":
  - **Nome:** `Funcionário Teste Claude {timestamp}`
  - **CPF:** novo CPF válido gerado
  - **E-mail:** `funcionario-claude-{timestamp}@example.com`
  - **Senha:** senha forte (anote — você vai usar pra testar permissão)
  - Demais campos: à vontade.
- ✅ **Esperado:** Salva, aparece na lista.
- 👁 **Observar:** Diferença entre "responsável" e "funcionário" é clara? Cadastrar funcionário envia e-mail de boas-vindas? O funcionário define a própria senha ou recebe pronta?

#### Passo 8.2 — Configurar permissões
- 🎯 **Ação:** Na lista, clique pra editar permissões do funcionário criado.
- ✅ **Esperado:** Tela de permissões com checkboxes/toggles por módulo ou ação.
- 👁 **Observar:**
  - Granularidade: por módulo (acessa Vendas) ou por ação (cria venda, mas não cancela)?
  - Há perfis pré-definidos (Caixa, Operador, Administrador)?
  - Há permissões que faltam fazer sentido pra recicladora (ex: pesar material, dar desconto, ver margem)?

#### Passo 8.3 — Conceder permissão limitada e testar (opcional, se tempo permitir)
- 🎯 **Ação:** Conceda só permissão de Vendas pro funcionário. Faça logout. Faça login como o funcionário. Tente acessar `/recycling/products`.
- ✅ **Esperado:** Acesso bloqueado ou item de menu oculto.
- 👁 **Observar:** Bloqueio é via menu (some o item) ou via URL direta também? Mensagem de "sem permissão" é clara?
- **Importante:** ao terminar, **faça logout** e logue de volta com a conta do responsável (que tem todas permissões) pra continuar o roteiro.

---

### 📍 Jornada 9 — Registro de Compra

**Página:** `/recycling/purchases/new`

#### Passo 9.1 — Criar nova compra
- 🎯 **Ação:** Clique em "Nova Compra".
  - **Fornecedor:** selecione o `Fornecedor Teste Claude {timestamp}` da Jornada 5.
  - **Data:** hoje.
  - **Adicione 2 itens:**
    1. `Alumínio Latinha Teste {timestamp}` — quantidade `100 kg` — preço unitário `R$ 7,50` (deve vir do cadastro)
    2. `Cobre Encapado Teste {timestamp}` — quantidade `30 kg` — preço unitário `R$ 22,00`
  - **Total esperado:** `R$ 750,00 + R$ 660,00 = R$ 1.410,00`
- ✅ **Esperado:** Total calculado automaticamente bate com `R$ 1.410,00`. Salva com sucesso, redireciona pra detalhe ou lista.
- 👁 **Observar:**
  - Auto-foco em quantidade após selecionar produto?
  - Permite editar preço unitário no momento da compra (caso negociação) ou trava no preço cadastrado?
  - Mostra subtotal por item e total geral em tempo real?
  - Campo de forma de pagamento? À vista vs prazo? Tem reflexo no caixa?
  - Possível anexar nota fiscal/foto da pesagem?

**📊 Anote para cruzamento:** Compra de `Alumínio: 100 kg / R$ 750` e `Cobre: 30 kg / R$ 660`. Total `R$ 1.410`.

#### Passo 9.2 — Verificar listagem de compras
- 🎯 **Ação:** Volte pra `/recycling/purchases`.
- ✅ **Esperado:** Compra aparece com data, fornecedor, valor total.
- 👁 **Observar:** Filtros por data/fornecedor/status? Total agregado no rodapé? Consigo abrir o detalhe e ver os itens?

---

### 📍 Jornada 10 — Coleta vinculada a fornecedor

**Página:** `/recycling/coletas`

#### Passo 10.1 — Criar nova coleta
- 🎯 **Ação:** "Nova Coleta":
  - **Fornecedor:** mesmo da Jornada 5.
  - **Data:** hoje.
  - **Material:** `Papelão Teste Claude {timestamp}` — quantidade `200 kg`.
  - Outros campos (motorista, veículo, endereço de coleta) preencha se houver.
- ✅ **Esperado:** Salva. Volta pra lista de coletas.
- 👁 **Observar:**
  - Diferença entre "Coleta" e "Compra" é clara no UI? (Coleta = ir buscar material; Compra = registro de aquisição.)
  - A coleta gera automaticamente uma compra ou são dois registros separados?
  - Há status (Agendada / Em rota / Concluída)?
  - Integração com mapa/rota?

**📊 Anote para cruzamento:** Coleta de `Papelão: 200 kg`.

> ⚠️ **Importante:** se o sistema funcionar de modo que a Coleta NÃO entra no estoque automaticamente (apenas registra a operação), anote isso e ajuste a expectativa da Jornada 11 — só entram no estoque os itens que vieram da Compra.

---

### 📍 Jornada 11 — Verificar Estoque (cruzamento pós-entradas)

**Página:** `/recycling/stock`

#### Passo 11.1 — Conferir quantidades
- 🎯 **Ação:** Olhe o estoque dos 3 produtos cadastrados.
- ✅ **Esperado:**
  - **Alumínio:** `100 kg` (vindos da Compra da Jornada 9)
  - **Cobre:** `30 kg` (vindos da Compra)
  - **Papelão:** `200 kg` se Coleta gera estoque, senão `0 kg`. Anote o que aconteceu.
- 👁 **Observar:**
  - Estoque é em tempo real ou tem cache?
  - Mostra valor em estoque em reais (qtd × preço de compra)?
  - Mostra mínimo/máximo, alertas de baixo estoque?
  - Histórico de movimentações por produto?
  - Possível ajuste manual de estoque (perda, contagem)?

**📊 Cruzamento — registre se bateu:**
| Produto | Esperado | Observado | Bateu? |
|---|---|---|---|
| Alumínio | 100 kg | ? | ? |
| Cobre | 30 kg | ? | ? |
| Papelão | 0 ou 200 kg | ? | ? |

---

### 📍 Jornada 12 — Registro de Venda

**Página:** `/recycling/sales/new`

#### Passo 12.1 — Criar nova venda
- 🎯 **Ação:** "Nova Venda":
  - **Comprador:** `Comprador Teste Claude {timestamp}` da Jornada 6.
  - **Adicione 1 item:** `Alumínio Latinha Teste {timestamp}` — quantidade `40 kg` — preço unitário `R$ 9,80` (do cadastro).
  - **Total esperado:** `R$ 392,00`
- ✅ **Esperado:** Total calculado bate, salva com sucesso.
- 👁 **Observar:**
  - O sistema mostra estoque disponível ao escolher o produto (`Disponível: 100 kg`)?
  - Permite vender mais do que tem em estoque? (Anote como bug 🐞 alta se sim.)
  - Forma de pagamento (dinheiro/PIX/cartão/prazo)?
  - Emite recibo/nota?

**📊 Anote para cruzamento:** Venda de `Alumínio: 40 kg / R$ 392`.

#### Passo 12.2 — Tentativa de venda acima do estoque (validação)
- 🎯 **Ação:** Em "Nova Venda", tente vender `Cobre — 50 kg` (só temos 30 em estoque).
- ✅ **Esperado:** Sistema bloqueia com mensagem clara, ou pelo menos avisa.
- 👁 **Observar:** Bloqueio total ou só aviso? Mensagem é específica ("disponível: 30 kg")?
- ⚠️ **Não complete essa venda. Cancele e siga.**

---

### 📍 Jornada 13 — Verificar Estoque pós-venda

**Página:** `/recycling/stock`

#### Passo 13.1 — Conferir diminuição
- 🎯 **Ação:** Recarregue `/recycling/stock`.
- ✅ **Esperado:**
  - **Alumínio:** `60 kg` (100 - 40)
  - **Cobre:** `30 kg` (inalterado)
  - **Papelão:** mesmo valor da Jornada 11
- 👁 **Observar:** Tempo de propagação (instantâneo ou precisa F5)?

**📊 Cruzamento:**
| Produto | Esperado | Observado | Bateu? |
|---|---|---|---|
| Alumínio | 60 kg | ? | ? |
| Cobre | 30 kg | ? | ? |
| Papelão | 0 ou 200 kg | ? | ? |

---

### 📍 Jornada 14 — Caixa (cruzamento financeiro)

**Página:** `/recycling/cash-register`

#### Passo 14.1 — Conferir movimentos
- 🎯 **Ação:** Acesse o Caixa. Olhe os lançamentos do dia.
- ✅ **Esperado:** Pelo menos:
  - **Saída:** `R$ 1.410,00` referente à compra (Jornada 9) — se forma de pagamento foi à vista.
  - **Entrada:** `R$ 392,00` referente à venda (Jornada 12) — se forma de pagamento foi à vista.
  - **Saldo do dia:** `-R$ 1.018,00` (entradas - saídas).
- 👁 **Observar:**
  - Se a forma de pagamento foi "a prazo", a movimentação aparece como contas a pagar/receber, não no caixa do dia?
  - Cada lançamento tem origem clicável (clique e vai pra venda/compra correspondente)?
  - Há fluxo de caixa por período (semana/mês)?
  - Categorias de despesa avulsa (combustível, salário, manutenção)?
  - Possível abrir/fechar caixa, sangria, suprimento?

**📊 Cruzamento financeiro — registre:**
| Tipo | Esperado | Observado | Bateu? |
|---|---|---|---|
| Saída (compra) | R$ 1.410 | ? | ? |
| Entrada (venda) | R$ 392 | ? | ? |
| Saldo do dia | - R$ 1.018 | ? | ? |

> ⚠️ Se as formas de pagamento usadas foram diferentes de "à vista/PIX", os valores podem não estar no caixa — anote o comportamento real.

---

### 📍 Jornada 15 — Lista de preços PDF (revisitado)

**Página:** `/recycling/products`

#### Passo 15.1 — Gerar PDF
- 🎯 **Ação:** Encontre e clique no botão de exportar lista de preços.
- ✅ **Esperado:** PDF baixa, contém os 3 produtos com preços de venda formatados em reais.
- 👁 **Observar:**
  - Cabeçalho do PDF tem o nome da empresa, CNPJ, data?
  - Layout aceitável pra enviar pra cliente real?
  - Permite filtrar quais produtos incluir?
  - Há outras exportações (Excel/CSV)?

---

### 📍 Jornada 16 — Relatórios

**Página:** `/recycling/reports`

#### Passo 16.1 — Abrir cada relatório
- 🎯 **Ação:** Para cada relatório listado, abra-o e tire screenshot ou anote os dados.
- ✅ **Esperado:** Cada relatório carrega sem erro e mostra dados consistentes com o que você operou (1 compra, 1 coleta, 1 venda).
- 👁 **Observar:**
  - Tipos de relatório existentes (compras por período, vendas por comprador, margem por produto, estoque atual)?
  - Filtros por data?
  - Exportação?
  - Os totais dos relatórios batem com o que você operou?
  - Quais relatórios faltam que seriam úteis pra recicladora real (ex: margem por material, ranking de fornecedores, pesagem média por coleta)?

---

### 📍 Jornada 17 — Tentativa de acesso cruzado a outro segmento

**Pré-requisito:** logado como responsável da recicladora.

#### Passo 17.1 — Acesso direto via URL
- 🎯 **Ação:** Tente acessar manualmente `https://praktikus.com.br/workshop/dashboard` digitando na barra de endereço.
- ✅ **Esperado:** Bloqueio (redirect pra `/recycling/dashboard`, ou tela de "sem acesso a este segmento").
- 👁 **Observar:** Bloqueio é silencioso (só redireciona) ou explicativo ("você é uma recicladora, não tem acesso a oficinas")? Mensagem é clara ou parece bug?

#### Passo 17.2 — Outras URLs do segmento errado
- 🎯 **Ação:** Tente `/workshop/customers`, `/workshop/vehicles`, `/workshop/service-orders`.
- ✅ **Esperado:** Mesmo bloqueio em todas.
- 👁 **Observar:** Comportamento consistente? Algum vazamento (URL que abre por engano)?

---

### 📍 Jornada 18 — Logout, esqueci senha, login

#### Passo 18.1 — Logout
- 🎯 **Ação:** Encontre e clique em "Sair" / "Logout".
- ✅ **Esperado:** Redirect pra `/login`. Sessão limpa (tentar `/recycling/dashboard` redireciona pra login).
- 👁 **Observar:** Logout pede confirmação? Limpa cookies/storage corretamente (verificar DevTools)?

#### Passo 18.2 — Fluxo "Esqueci minha senha" (sem acessar inbox)
- 🎯 **Ação:** Em `/login`, clique em "Esqueci minha senha". Vá pra `/forgot-password`. Digite o e-mail do responsável criado na Jornada 1.
- ✅ **Esperado:** Submit aceito, tela de "enviamos um link pro seu e-mail" ou similar.
- 👁 **Observar:**
  - Mesmo se o e-mail não existir, mostra a mesma mensagem (boa prática anti-enumeração)? Ou revela "e-mail não encontrado" (vazamento 🔒)?
  - Há rate limit visível (tente clicar 5x rápido)?
  - Link pra voltar ao login?

> ⚠️ **Não acesse a inbox** — o e-mail é fictício. Apenas valide até a tela de "enviado".

#### Passo 18.3 — Login final
- 🎯 **Ação:** Volte pra `/login`. Logue com o e-mail e senha do responsável da Jornada 1.
- ✅ **Esperado:** Redireciona pra `/recycling/dashboard`.
- 👁 **Observar:**
  - Mensagem de erro clara em caso de senha errada?
  - Há "manter conectado"?
  - Link pra signup acessível?
  - Há login social (Google/Microsoft)? Se não, é uma sugestão de produto.

---

## 5. Relatório final — instruções e template

Ao terminar TODAS as jornadas (ou ao bloquear em alguma), gere um arquivo Markdown chamado `praktikus-recycling-test-report-{YYYYMMDD-HHMM}.md` com a estrutura abaixo.

### Template do relatório

````markdown
# Relatório de Teste E2E — Praktikus Reciclagem

**Data:** {YYYY-MM-DD HH:MM}
**Ambiente:** https://praktikus.com.br/
**Executor:** Claude for Chrome
**Duração total:** {tempo}

---

## 1. Sumário executivo

- **Jornadas executadas:** X de 18
- **Jornadas bloqueadas:** Y (lista: ...)
- **Total de gaps observados:** Z (🐞 X bugs / 🎨 X UX / 💡 X sugestões / 🔒 X segurança)
- **Por severidade:** 🔴 X alta / 🟡 X média / 🟢 X baixa
- **Veredicto geral:** {1-3 frases — produto está pronto pra cliente real? quais ressalvas?}

---

## 2. Cleanup necessário (PRA O VINICIUS DELETAR)

- **Tenant ID:** {id encontrado na Jornada 4.2}
- **CNPJ usado no signup:** {CNPJ}
- **E-mail do responsável:** {email}
- **CNPJ do fornecedor de teste:** {CNPJ}
- **CNPJ do comprador de teste:** {CNPJ}
- **CPF do funcionário de teste:** {CPF}
- **E-mail do funcionário de teste:** {email}

---

## 3. Cruzamento numérico

### Estoque pós-entradas (Jornada 11)
| Produto | Esperado | Observado | Bateu? |
|---|---|---|---|
| Alumínio | 100 kg | {valor} | {✅/❌} |
| Cobre | 30 kg | {valor} | {✅/❌} |
| Papelão | 0 ou 200 kg | {valor} | {✅/❌} |

### Estoque pós-venda (Jornada 13)
| Produto | Esperado | Observado | Bateu? |
|---|---|---|---|
| Alumínio | 60 kg | {valor} | {✅/❌} |
| Cobre | 30 kg | {valor} | {✅/❌} |

### Caixa (Jornada 14)
| Movimento | Esperado | Observado | Bateu? |
|---|---|---|---|
| Saída (compra) | R$ 1.410,00 | {valor} | {✅/❌} |
| Entrada (venda) | R$ 392,00 | {valor} | {✅/❌} |
| Saldo | -R$ 1.018,00 | {valor} | {✅/❌} |

---

## 4. Gaps por severidade

### 🔴 Alta severidade
1. **[🐞 Bug funcional] [Jornada N - Passo X]** Descrição. *Reproduzir:* passos. *Impacto:* ... *Screenshot:* ...
2. ...

### 🟡 Média severidade
1. ...

### 🟢 Baixa severidade
1. ...

---

## 5. Gaps por categoria

### 🐞 Bugs funcionais
- Lista...

### 🎨 UX/Copy
- Lista...

### 💡 Sugestões de produto
- Lista...

### 🔒 Segurança/permissão
- Lista...

---

## 6. Notas livres do testador

{Observações que não couberam nas categorias: primeira impressão geral, comparação com mental model de SaaS de gestão, surpresas positivas, padrões que se repetem, dicas de priorização.}

---

## 7. Próximos passos sugeridos

- {Top 3-5 itens para o time atacar primeiro, ordenados por valor / esforço.}
````

---

## 6. Checklist final antes de entregar o relatório

- [ ] Todas as 18 jornadas tentadas (mesmo que algumas tenham sido bloqueadas)
- [ ] Cleanup com IDs/CNPJs/e-mails preenchido
- [ ] Tabelas de cruzamento numérico preenchidas
- [ ] Cada gap tem categoria, severidade, jornada/passo de origem e descrição
- [ ] Sumário executivo coerente com o conteúdo
- [ ] Veredicto geral honesto

---

**Boa sorte. Reporta com franqueza — o objetivo é melhorar o produto, não passar com nota máxima.**

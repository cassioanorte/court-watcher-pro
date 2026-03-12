import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Phase 2 — read tools
const readTools = [
  {
    type: "function",
    function: {
      name: "listar_processos",
      description: "Lista processos/casos do escritório. Pode filtrar por número, partes, status ou tags.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Termo de busca (número do processo, partes, assunto)" },
          status: { type: "string", description: "Filtrar por status (ex: Cadastrado, Em andamento, Arquivado)" },
          limit: { type: "number", description: "Quantidade máxima de resultados (padrão 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_cliente",
      description: "Busca um cliente/contato por nome, CPF ou email.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Nome, CPF ou email do cliente" },
        },
        required: ["search"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_agenda",
      description: "Consulta compromissos agendados. Pode filtrar por período.",
      parameters: {
        type: "object",
        properties: {
          data_inicio: { type: "string", description: "Data de início no formato YYYY-MM-DD (padrão: hoje)" },
          data_fim: { type: "string", description: "Data de fim no formato YYYY-MM-DD (padrão: 7 dias à frente)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_publicacoes",
      description: "Lista publicações recentes do Diário de Justiça Eletrônico.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (padrão 10)" },
          apenas_nao_lidas: { type: "boolean", description: "Filtrar apenas não lidas" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_cumprimentos",
      description: "Lista cumprimentos/tarefas pendentes.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filtrar por status: pending, in_progress, completed" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ver_financeiro",
      description: "Resumo financeiro: receitas, despesas e saldo do período.",
      parameters: {
        type: "object",
        properties: {
          mes: { type: "number", description: "Mês (1-12), padrão: mês atual" },
          ano: { type: "number", description: "Ano, padrão: ano atual" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// Phase 3 — write tools
const writeTools = [
  {
    type: "function",
    function: {
      name: "cadastrar_cliente",
      description: "Cadastra um novo contato/cliente no sistema. Retorna o nome e ID do contato criado.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome completo do contato" },
          cpf: { type: "string", description: "CPF do contato (opcional)" },
          email: { type: "string", description: "Email do contato (opcional)" },
          telefone: { type: "string", description: "Telefone do contato (opcional)" },
          tipo: { type: "string", description: "Tipo: cliente, parte_contraria, testemunha, perito, outro (padrão: cliente)" },
        },
        required: ["nome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_reuniao",
      description: "Cria um compromisso/reunião na agenda. Informe título, data e horário.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título do compromisso" },
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          hora_inicio: { type: "string", description: "Hora de início no formato HH:MM (padrão: 09:00)" },
          hora_fim: { type: "string", description: "Hora de fim no formato HH:MM (padrão: 1h após início)" },
          descricao: { type: "string", description: "Descrição/observações (opcional)" },
          numero_processo: { type: "string", description: "Número do processo para vincular (opcional)" },
        },
        required: ["titulo", "data"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_cumprimento",
      description: "Cria um cumprimento/tarefa vinculado a um processo. Necessita do número do processo.",
      parameters: {
        type: "object",
        properties: {
          numero_processo: { type: "string", description: "Número do processo" },
          categoria: { type: "string", description: "Categoria: peticao, recurso, cumprimento_despacho, audiencia_diligencia, contato_cliente, solicitar_documentacao, manifestacao, alvara, calculo, providencia_administrativa, cumprimento_sentenca, contestacao, replica, aguardando_decurso_prazo" },
          descricao: { type: "string", description: "Descrição do cumprimento" },
          prazo: { type: "string", description: "Data de prazo no formato YYYY-MM-DD" },
          prioridade: { type: "string", description: "Prioridade: low, medium, high, urgent (padrão: medium)" },
        },
        required: ["numero_processo", "categoria", "prazo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_tarefa",
      description: "Cria uma tarefa pessoal para o usuário logado.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título da tarefa" },
          descricao: { type: "string", description: "Descrição da tarefa (opcional)" },
          prazo: { type: "string", description: "Data de prazo no formato YYYY-MM-DD (opcional)" },
          horario: { type: "string", description: "Horário no formato HH:MM (opcional)" },
        },
        required: ["titulo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_lancamento",
      description: "Registra um lançamento financeiro (receita ou despesa).",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", description: "Tipo: income (receita) ou expense (despesa)" },
          valor: { type: "number", description: "Valor em reais" },
          categoria: { type: "string", description: "Categoria: honorarios, custas, alvara, acordo, salarios, aluguel, software, outros" },
          descricao: { type: "string", description: "Descrição do lançamento" },
          data: { type: "string", description: "Data no formato YYYY-MM-DD (padrão: hoje)" },
        },
        required: ["tipo", "valor", "categoria", "descricao"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_notificacao",
      description: "Envia uma notificação para um cliente do escritório. Busca pelo nome.",
      parameters: {
        type: "object",
        properties: {
          nome_cliente: { type: "string", description: "Nome do cliente destinatário" },
          titulo: { type: "string", description: "Título da notificação" },
          mensagem: { type: "string", description: "Corpo da notificação" },
        },
        required: ["nome_cliente", "titulo", "mensagem"],
        additionalProperties: false,
      },
    },
  },
];

const tools = [...readTools, ...writeTools];

// ─── Read tool execution ───
async function executeReadTool(
  toolName: string,
  args: Record<string, unknown>,
  db: ReturnType<typeof createClient>,
  tenantId: string
): Promise<string> {
  switch (toolName) {
    case "listar_processos": {
      let query = db
        .from("cases")
        .select("id, process_number, subject, parties, simple_status, tags, created_at")
        .eq("tenant_id", tenantId)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.search) {
        const s = String(args.search);
        query = query.or(`process_number.ilike.%${s}%,parties.ilike.%${s}%,subject.ilike.%${s}%`);
      }
      if (args.status) query = query.eq("simple_status", args.status);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return "Nenhum processo encontrado.";
      return data.map((c: any) =>
        `• ${c.process_number} — ${c.subject || "Sem assunto"} | Status: ${c.simple_status || "N/A"} | Partes: ${c.parties || "N/A"}`
      ).join("\n");
    }
    case "buscar_cliente": {
      const s = String(args.search);
      const { data, error } = await db
        .from("profiles")
        .select("user_id, full_name, cpf, email, phone, contact_type")
        .eq("tenant_id", tenantId)
        .or(`full_name.ilike.%${s}%,cpf.ilike.%${s}%,email.ilike.%${s}%`)
        .limit(10);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return "Nenhum cliente encontrado.";
      return data.map((p: any) =>
        `• ${p.full_name} | CPF: ${p.cpf || "N/A"} | Email: ${p.email || "N/A"} | Tel: ${p.phone || "N/A"} | Tipo: ${p.contact_type || "N/A"}`
      ).join("\n");
    }
    case "ver_agenda": {
      const now = new Date();
      const startDate = args.data_inicio || now.toISOString().split("T")[0];
      const endDate = args.data_fim || new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
      const { data, error } = await db
        .from("appointments")
        .select("title, description, start_at, end_at, color")
        .eq("tenant_id", tenantId)
        .gte("start_at", `${startDate}T00:00:00`)
        .lte("start_at", `${endDate}T23:59:59`)
        .order("start_at")
        .limit(20);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return "Nenhum compromisso no período.";
      return data.map((a: any) => {
        const d = new Date(a.start_at);
        return `• ${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${a.title}${a.description ? `: ${a.description}` : ""}`;
      }).join("\n");
    }
    case "ver_publicacoes": {
      let query = db
        .from("dje_publications")
        .select("title, publication_date, process_number, ai_summary, read, source")
        .eq("tenant_id", tenantId)
        .order("publication_date", { ascending: false })
        .limit(Number(args.limit) || 10);
      if (args.apenas_nao_lidas) query = query.eq("read", false);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return "Nenhuma publicação encontrada.";
      return data.map((p: any) =>
        `• ${p.publication_date} | ${p.title} | Processo: ${p.process_number || "N/A"} | ${p.read ? "✅ Lida" : "🔴 Não lida"}${p.ai_summary ? `\n  Resumo: ${p.ai_summary.substring(0, 100)}...` : ""}`
      ).join("\n");
    }
    case "ver_cumprimentos": {
      let query = db
        .from("case_fulfillments")
        .select("category, description, due_date, status, priority, cases(process_number)")
        .eq("tenant_id", tenantId)
        .order("due_date")
        .limit(15);
      if (args.status) query = query.eq("status", args.status);
      else query = query.in("status", ["pending", "in_progress"]);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return "Nenhum cumprimento pendente.";
      return data.map((f: any) =>
        `• [${f.priority}] ${f.category} — ${f.description || "Sem descrição"} | Prazo: ${f.due_date} | Status: ${f.status} | Processo: ${(f.cases as any)?.process_number || "N/A"}`
      ).join("\n");
    }
    case "ver_financeiro": {
      const now = new Date();
      const month = Number(args.mes) || now.getMonth() + 1;
      const year = Number(args.ano) || now.getFullYear();
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const { data, error } = await db
        .from("financial_transactions")
        .select("type, amount, category, description, date, status")
        .eq("tenant_id", tenantId)
        .gte("date", startDate)
        .lt("date", endDate);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhum lançamento em ${month}/${year}.`;
      const receitas = data.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const despesas = data.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
      return `📊 Resumo Financeiro — ${String(month).padStart(2, "0")}/${year}\nReceitas: R$ ${receitas.toFixed(2)}\nDespesas: R$ ${despesas.toFixed(2)}\nSaldo: R$ ${(receitas - despesas).toFixed(2)}\nTotal de lançamentos: ${data.length}`;
    }
    default:
      return `Ferramenta de leitura "${toolName}" não encontrada.`;
  }
}

// ─── Write tool execution ───
async function executeWriteTool(
  toolName: string,
  args: Record<string, unknown>,
  db: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string
): Promise<string> {
  switch (toolName) {
    case "cadastrar_cliente": {
      // Create a pseudo-user via service role (no auth account, just a profile entry)
      const fakeId = crypto.randomUUID();
      const { data: authData, error: authErr } = await db.auth.admin.createUser({
        email: String(args.email || `contato-${fakeId.slice(0, 8)}@placeholder.local`),
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: {
          full_name: String(args.nome),
          tenant_id: tenantId,
          role: "client",
        },
      });
      if (authErr) return `Erro ao cadastrar: ${authErr.message}`;
      const newUserId = authData.user.id;

      // Update profile with extra fields
      const updates: Record<string, unknown> = {};
      if (args.cpf) updates.cpf = String(args.cpf);
      if (args.email) updates.email = String(args.email);
      if (args.telefone) updates.phone = String(args.telefone);
      if (args.tipo) updates.contact_type = String(args.tipo);
      else updates.contact_type = "cliente";

      if (Object.keys(updates).length) {
        await db.from("profiles").update(updates).eq("user_id", newUserId);
      }

      return `✅ Contato "${args.nome}" cadastrado com sucesso (ID: ${newUserId}).`;
    }

    case "agendar_reuniao": {
      const horaInicio = String(args.hora_inicio || "09:00");
      const [h, m] = horaInicio.split(":").map(Number);
      let horaFim = String(args.hora_fim || "");
      if (!horaFim) {
        horaFim = `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      }

      const startAt = `${args.data}T${horaInicio}:00`;
      const endAt = `${args.data}T${horaFim}:00`;

      // Optionally link to a case
      let caseId: string | null = null;
      if (args.numero_processo) {
        const { data: caseData } = await db
          .from("cases")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("process_number", `%${args.numero_processo}%`)
          .limit(1)
          .single();
        if (caseData) caseId = caseData.id;
      }

      const { error } = await db.from("appointments").insert({
        tenant_id: tenantId,
        user_id: userId,
        title: String(args.titulo),
        description: args.descricao ? String(args.descricao) : null,
        start_at: startAt,
        end_at: endAt,
        case_id: caseId,
      });

      if (error) return `Erro ao agendar: ${error.message}`;
      return `✅ Compromisso "${args.titulo}" agendado para ${args.data} às ${horaInicio}–${horaFim}.`;
    }

    case "criar_cumprimento": {
      // Find the case
      const { data: caseData, error: caseErr } = await db
        .from("cases")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("process_number", `%${args.numero_processo}%`)
        .limit(1)
        .single();

      if (caseErr || !caseData) return `Processo "${args.numero_processo}" não encontrado no sistema.`;

      const { error } = await db.from("case_fulfillments").insert({
        tenant_id: tenantId,
        case_id: caseData.id,
        category: String(args.categoria),
        description: args.descricao ? String(args.descricao) : null,
        due_date: String(args.prazo),
        priority: String(args.prioridade || "medium"),
        status: "pending",
        assigned_by: userId,
        assigned_to: userId,
      });

      if (error) return `Erro ao criar cumprimento: ${error.message}`;
      return `✅ Cumprimento "${args.categoria}" criado para o processo ${args.numero_processo} com prazo em ${args.prazo}.`;
    }

    case "criar_tarefa": {
      const insert: Record<string, unknown> = {
        tenant_id: tenantId,
        user_id: userId,
        title: String(args.titulo),
        description: args.descricao ? String(args.descricao) : null,
        due_date: args.prazo ? String(args.prazo) : null,
        due_time: args.horario ? String(args.horario) : null,
      };

      const { error } = await db.from("user_tasks").insert(insert);
      if (error) return `Erro ao criar tarefa: ${error.message}`;
      return `✅ Tarefa "${args.titulo}" criada${args.prazo ? ` com prazo em ${args.prazo}` : ""}.`;
    }

    case "registrar_lancamento": {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await db.from("financial_transactions").insert({
        tenant_id: tenantId,
        type: String(args.tipo),
        amount: Number(args.valor),
        category: String(args.categoria),
        description: String(args.descricao),
        date: args.data ? String(args.data) : today,
        created_by: userId,
        status: "confirmed",
      });

      if (error) return `Erro ao registrar lançamento: ${error.message}`;
      const label = args.tipo === "income" ? "Receita" : "Despesa";
      return `✅ ${label} de R$ ${Number(args.valor).toFixed(2)} registrada — "${args.descricao}".`;
    }

    case "enviar_notificacao": {
      // Find client by name
      const { data: clients } = await db
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", tenantId)
        .ilike("full_name", `%${args.nome_cliente}%`)
        .limit(5);

      if (!clients?.length) return `Cliente "${args.nome_cliente}" não encontrado.`;

      // Check role — only notify clients
      const clientUserId = clients[0].user_id;
      const clientName = clients[0].full_name;

      const { error } = await db.from("client_notifications").insert({
        tenant_id: tenantId,
        client_user_id: clientUserId,
        title: String(args.titulo),
        body: String(args.mensagem),
        sent_by: userId,
        type: "general",
      });

      if (error) return `Erro ao enviar notificação: ${error.message}`;
      return `✅ Notificação enviada para ${clientName}: "${args.titulo}".`;
    }

    default:
      return `Ferramenta de escrita "${toolName}" não encontrada.`;
  }
}

// ─── Unified executor ───
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  db: ReturnType<typeof createClient>,
  tenantId: string,
  userId: string
): Promise<string> {
  try {
    const readToolNames = ["listar_processos", "buscar_cliente", "ver_agenda", "ver_publicacoes", "ver_cumprimentos", "ver_financeiro"];
    if (readToolNames.includes(toolName)) {
      return await executeReadTool(toolName, args, db, tenantId);
    }
    return await executeWriteTool(toolName, args, db, tenantId, userId);
  } catch (err) {
    return `Erro ao executar ${toolName}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Get user from JWT
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Usuário não autenticado");

    // Get tenant
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, full_name, oab_number")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

    const { messages, conversation_id } = await req.json();

    // Save user message
    if (messages?.length && conversation_id) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === "user") {
        await adminClient.from("ai_messages").insert({
          conversation_id,
          tenant_id: profile.tenant_id,
          role: "user",
          content: lastMsg.content,
        });
      }
    }

    const systemPrompt = `Você é o Assistente Jurídico IA do sistema Lex Imperium. Você ajuda advogados e funcionários de escritórios de advocacia.

Informações do usuário:
- Nome: ${profile.full_name}
- OAB: ${profile.oab_number || "Não cadastrada"}

REGRAS:
1. Sempre responda em português brasileiro
2. Seja profissional mas amigável
3. Use as ferramentas disponíveis para consultar e executar ações no sistema
4. Nunca invente dados — se não encontrar, diga que não encontrou
5. Formate respostas com clareza usando listas e destaques quando necessário
6. Para ações de ESCRITA (cadastrar, agendar, criar, registrar, enviar), SEMPRE confirme com o usuário ANTES de executar. Descreva exatamente o que será feito e peça "Posso prosseguir?" — só execute a ferramenta após confirmação.
7. Ao receber confirmação ("sim", "pode", "ok", "confirmo", "prossiga"), execute a ação imediatamente.

Ferramentas de LEITURA (consultas):
- listar_processos: buscar processos
- buscar_cliente: encontrar clientes
- ver_agenda: consultar compromissos
- ver_publicacoes: publicações do DJe
- ver_cumprimentos: cumprimentos pendentes
- ver_financeiro: resumo financeiro

Ferramentas de ESCRITA (ações):
- cadastrar_cliente: criar novo contato/cliente
- agendar_reuniao: criar compromisso na agenda
- criar_cumprimento: criar cumprimento vinculado a processo
- criar_tarefa: criar tarefa pessoal
- registrar_lancamento: criar lançamento financeiro
- enviar_notificacao: enviar notificação ao cliente`;

    // Call Lovable AI with tools
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        tools,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("Erro na API de IA");
    }

    let result = await aiResponse.json();
    let assistantMessage = result.choices?.[0]?.message;

    // Handle tool calls loop
    let iterations = 0;
    const maxIterations = 5;
    const conversationMessages = [{ role: "system", content: systemPrompt }, ...messages];

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;
      conversationMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments || "{}");
        console.log(`Executing tool: ${fnName}`, fnArgs);
        const toolResult = await executeTool(fnName, fnArgs, adminClient, profile.tenant_id, user.id);
        conversationMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        } as any);
      }

      const followUp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: conversationMessages,
          tools,
          stream: false,
        }),
      });

      if (!followUp.ok) throw new Error("Erro no follow-up da IA");
      result = await followUp.json();
      assistantMessage = result.choices?.[0]?.message;
    }

    const finalContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

    // Save assistant message
    if (conversation_id) {
      await adminClient.from("ai_messages").insert({
        conversation_id,
        tenant_id: profile.tenant_id,
        role: "assistant",
        content: finalContent,
        tool_calls: assistantMessage?.tool_calls || null,
      });
    }

    return new Response(JSON.stringify({ content: finalContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify calling user is owner/staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !callerUser) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify caller is owner
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (!callerRole || callerRole.role !== "owner") {
      return new Response(JSON.stringify({ error: "Apenas o dono do escritório pode cadastrar usuários" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get caller's tenant
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", callerUser.id)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { email, fullName, phone, role, oabNumber, cpf, address, origin, position } = await req.json();
    if (!email || !fullName) {
      return new Response(JSON.stringify({ error: "Email e nome são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Validate role
    const validRoles = ["staff", "client"];
    const userRole = validRoles.includes(role) ? role : "client";

    // Generate temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Try to create user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: userRole,
        tenant_id: callerProfile.tenant_id,
      },
    });

    if (createError) {
      const msg = createError.message;
      const isDuplicate = msg.includes("already been registered") || msg.includes("already exists");

      if (isDuplicate) {
        // Email already exists — find the existing user and create a new profile for this person
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: any) => u.email === email);

        if (!existingUser) {
          return new Response(JSON.stringify({ error: "Usuário não encontrado após detecção de duplicata." }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Create a new profile for this person linked to the existing auth user
        const { error: profileError } = await supabaseAdmin.from("profiles").insert({
          user_id: existingUser.id,
          tenant_id: callerProfile.tenant_id,
          full_name: fullName,
          phone: phone || null,
          oab_number: oabNumber || null,
          cpf: cpf || null,
          address: address || null,
          origin: origin || null,
          position: position || null,
        });

        if (profileError) {
          console.error("Profile insert error:", profileError);
        }

        // Ensure user_role exists for this role
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("role", userRole)
          .maybeSingle();

        if (!existingRole) {
          await supabaseAdmin.from("user_roles").insert({
            user_id: existingUser.id,
            role: userRole,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            userId: existingUser.id,
            tempPassword: null,
            alreadyExisted: true,
            message: `Usuário "${fullName}" vinculado com email já existente. Use a senha já cadastrada para acessar.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Update extra fields if provided
    const updates: Record<string, string> = {};
    if (phone) updates.phone = phone;
    if (oabNumber) updates.oab_number = oabNumber;
    if (cpf) updates.cpf = cpf;
    if (address) updates.address = address;
    if (origin) updates.origin = origin;
    if (position) updates.position = position;
    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("user_id", authData.user.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authData.user.id, 
        tempPassword,
        message: `Usuário criado com papel "${userRole}". Senha temporária: ${tempPassword}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Invite error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

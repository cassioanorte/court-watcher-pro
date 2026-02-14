import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is owner
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Check caller is owner (user may have multiple roles)
    const { data: callerRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isOwner = (callerRoles || []).some((r: { role: string }) => r.role === "owner");
    if (!isOwner) {
      return new Response(JSON.stringify({ error: "Apenas o dono pode gerenciar a equipe" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller tenant
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id, updates } = await req.json();

    // Verify target belongs to same tenant
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("tenant_id, user_id")
      .eq("user_id", target_user_id)
      .single();

    if (!targetProfile || targetProfile.tenant_id !== callerProfile.tenant_id) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado neste escritório" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Owner can edit anyone including themselves

    if (action === "update") {
      const updateData: Record<string, string | null> = {};
      if (updates.full_name) updateData.full_name = updates.full_name;
      if (updates.phone !== undefined) updateData.phone = updates.phone || null;
      if (updates.oab_number !== undefined) updateData.oab_number = updates.oab_number || null;
      if (updates.cpf !== undefined) updateData.cpf = updates.cpf || null;
      if (updates.address !== undefined) updateData.address = updates.address || null;
      if (updates.origin !== undefined) updateData.origin = updates.origin || null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", target_user_id);

      if (updateError) throw updateError;

      // Reset password if provided
      if (updates.new_password && updates.new_password.length >= 6) {
        const { error: pwError } = await supabase.auth.admin.updateUserById(target_user_id, {
          password: updates.new_password,
        });
        if (pwError) throw pwError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Delete profile, role, and auth user
      await supabase.from("user_roles").delete().eq("user_id", target_user_id);
      await supabase.from("profiles").delete().eq("user_id", target_user_id);
      await supabase.auth.admin.deleteUser(target_user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[manage-team-member] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
      if (updates.position !== undefined) updateData.position = updates.position || null;
      if (updates.email !== undefined) updateData.email = updates.email || null;
      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", target_user_id);

      if (updateError) throw updateError;

      // Update auth user (password and/or email)
      const authUpdates: Record<string, string> = {};
      if (updates.new_password && updates.new_password.length >= 6) {
        authUpdates.password = updates.new_password;
      }
      if (updates.email) {
        authUpdates.email = updates.email;
      }
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabase.auth.admin.updateUserById(target_user_id, authUpdates);
        if (authError) throw authError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      // Safety: prevent deleting owner/staff users via this endpoint
      const { data: targetRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", target_user_id);
      const isStaffOrOwner = (targetRoles || []).some((r: { role: string }) => r.role === "owner" || r.role === "staff");
      if (isStaffOrOwner) {
        return new Response(JSON.stringify({ error: "Não é possível excluir um membro da equipe por aqui. Use a gestão de equipe." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Unlink from cases and clean up related data
      await supabase.from("cases").update({ client_user_id: null }).eq("client_user_id", target_user_id);
      await supabase.from("case_contacts").delete().eq("contact_user_id", target_user_id);
      await supabase.from("billing_collections").delete().eq("client_user_id", target_user_id);
      await supabase.from("client_notifications").delete().eq("client_user_id", target_user_id);
      await supabase.from("contact_documents").delete().eq("contact_user_id", target_user_id);
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

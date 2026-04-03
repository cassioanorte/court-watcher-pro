import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing x-api-key header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Hash the key to compare with stored hash
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate API key
    const { data: keyRow, error: keyError } = await supabase
      .from("api_keys")
      .select("id, tenant_id, is_active")
      .eq("key_hash", keyHash)
      .single();

    if (keyError || !keyRow || !keyRow.is_active) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = keyRow.tenant_id;

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    const body = await req.json();
    const { type, data: payload } = body;

    if (!type || !payload) {
      return new Response(JSON.stringify({ error: "Body must have 'type' and 'data' fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any = { type, processed: 0, errors: [] };
    const items = Array.isArray(payload) ? payload : [payload];

    switch (type) {
      case "movements": {
        for (const item of items) {
          if (!item.case_id || !item.title || !item.occurred_at) {
            results.errors.push({ item, error: "Missing case_id, title, or occurred_at" });
            continue;
          }
          const unique_hash = `${item.case_id}-${item.occurred_at}-${item.title}`.replace(/\s/g, "");
          const hashData = encoder.encode(unique_hash);
          const hBuf = await crypto.subtle.digest("SHA-256", hashData);
          const uHash = Array.from(new Uint8Array(hBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

          const { error } = await supabase.from("movements").upsert({
            case_id: item.case_id,
            title: item.title,
            details: item.details || null,
            occurred_at: item.occurred_at,
            source_label: item.source_label || "API",
            unique_hash: uHash,
          }, { onConflict: "unique_hash" });

          if (error) results.errors.push({ item: item.title, error: error.message });
          else results.processed++;
        }
        break;
      }

      case "processes": {
        for (const item of items) {
          if (!item.process_number) {
            results.errors.push({ item, error: "Missing process_number" });
            continue;
          }
          // Check if already exists
          const { data: existing } = await supabase
            .from("cases")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("process_number", item.process_number)
            .maybeSingle();

          if (existing) {
            // Update
            const { error } = await supabase.from("cases").update({
              parties: item.parties || undefined,
              subject: item.subject || undefined,
              case_summary: item.case_summary || undefined,
            }).eq("id", existing.id);
            if (error) results.errors.push({ item: item.process_number, error: error.message });
            else results.processed++;
          } else {
            // Insert
            const { error } = await supabase.from("cases").insert({
              tenant_id: tenantId,
              process_number: item.process_number,
              parties: item.parties || null,
              subject: item.subject || null,
              case_summary: item.case_summary || null,
              source: item.source || "manual",
            });
            if (error) results.errors.push({ item: item.process_number, error: error.message });
            else results.processed++;
          }
        }
        break;
      }

      case "documents": {
        for (const item of items) {
          if (!item.case_id || !item.name || !item.file_url) {
            results.errors.push({ item, error: "Missing case_id, name, or file_url" });
            continue;
          }
          const { error } = await supabase.from("documents").insert({
            case_id: item.case_id,
            name: item.name,
            file_url: item.file_url,
            category: item.category || null,
          });
          if (error) results.errors.push({ item: item.name, error: error.message });
          else results.processed++;
        }
        break;
      }

      case "publications": {
        for (const item of items) {
          if (!item.oab_number || !item.title || !item.publication_date) {
            results.errors.push({ item, error: "Missing oab_number, title, or publication_date" });
            continue;
          }
          const raw = `${tenantId}-${item.oab_number}-${item.publication_date}-${item.title}`.replace(/\s/g, "");
          const hData = encoder.encode(raw);
          const hBuf = await crypto.subtle.digest("SHA-256", hData);
          const uHash = Array.from(new Uint8Array(hBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

          const { error } = await supabase.from("dje_publications").upsert({
            tenant_id: tenantId,
            oab_number: item.oab_number,
            title: item.title,
            content: item.content || null,
            publication_date: item.publication_date,
            source: item.source || "api",
            unique_hash: uHash,
            process_number: item.process_number || null,
            organ: item.organ || null,
          }, { onConflict: "unique_hash" });

          if (error) results.errors.push({ item: item.title, error: error.message });
          else results.processed++;
        }
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}. Use: movements, processes, documents, publications` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

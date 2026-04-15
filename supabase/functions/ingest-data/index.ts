import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function validateApiKey(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { error: "Missing x-api-key header", status: 401 };

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: keyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("id, tenant_id, is_active")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !keyRow || !keyRow.is_active) {
    return { error: "Invalid or inactive API key", status: 401 };
  }

  // Update last_used_at
  await supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);

  return { tenantId: keyRow.tenant_id, supabase };
}

// ─── GET handler: read data ───
async function handleGet(req: Request) {
  const auth = await validateApiKey(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { tenantId, supabase } = auth;

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const search = url.searchParams.get("search") || "";
  const caseId = url.searchParams.get("case_id") || "";
  const since = url.searchParams.get("since") || ""; // ISO date filter

  if (!type) {
    return json({
      error: "Missing 'type' query param. Use: cases, movements, publications, documents",
      endpoints: {
        cases: "?type=cases&limit=50&offset=0&search=keyword&since=2025-01-01",
        movements: "?type=movements&case_id=uuid&limit=50&offset=0&since=2025-01-01",
        publications: "?type=publications&limit=50&offset=0&search=keyword&since=2025-01-01",
        documents: "?type=documents&case_id=uuid&limit=50&offset=0",
      },
    }, 400);
  }

  switch (type) {
    case "cases": {
      let query = supabase
        .from("cases")
        .select("id, process_number, parties, subject, case_summary, simple_status, tags, source, created_at, updated_at, client_user_id, responsible_user_id, archived", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`process_number.ilike.%${search}%,parties.ilike.%${search}%,subject.ilike.%${search}%`);
      }
      if (since) {
        query = query.gte("updated_at", since);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ type: "cases", data, total: count, limit, offset });
    }

    case "movements": {
      let query = supabase
        .from("movements")
        .select("id, case_id, title, details, occurred_at, source_label, translation, created_at", { count: "exact" })
        .order("occurred_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by tenant via case_id join
      if (caseId) {
        query = query.eq("case_id", caseId);
      }
      if (since) {
        query = query.gte("occurred_at", since);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,details.ilike.%${search}%`);
      }

      // Ensure tenant isolation: fetch valid case IDs first
      if (!caseId) {
        const { data: tenantCases } = await supabase
          .from("cases")
          .select("id")
          .eq("tenant_id", tenantId);
        const caseIds = (tenantCases || []).map((c: any) => c.id);
        if (caseIds.length === 0) return json({ type: "movements", data: [], total: 0, limit, offset });
        query = query.in("case_id", caseIds);
      } else {
        // Verify the case belongs to this tenant
        const { data: caseCheck } = await supabase
          .from("cases")
          .select("id")
          .eq("id", caseId)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (!caseCheck) return json({ error: "Case not found or not in your tenant" }, 404);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ type: "movements", data, total: count, limit, offset });
    }

    case "publications": {
      let query = supabase
        .from("dje_publications")
        .select("id, oab_number, source, publication_date, title, content, process_number, organ, case_id, ai_summary, ai_deadlines, ai_next_steps, created_at", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("publication_date", { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,process_number.ilike.%${search}%`);
      }
      if (since) {
        query = query.gte("publication_date", since);
      }
      if (caseId) {
        query = query.eq("case_id", caseId);
      }

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ type: "publications", data, total: count, limit, offset });
    }

    case "documents": {
      if (!caseId) {
        return json({ error: "case_id is required for documents query" }, 400);
      }

      // Verify tenant ownership
      const { data: caseCheck } = await supabase
        .from("cases")
        .select("id")
        .eq("id", caseId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!caseCheck) return json({ error: "Case not found or not in your tenant" }, 404);

      const { data, error, count } = await supabase
        .from("documents")
        .select("id, case_id, name, file_url, category, created_at", { count: "exact" })
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return json({ error: error.message }, 500);
      return json({ type: "documents", data, total: count, limit, offset });
    }

    default:
      return json({ error: `Unknown type: ${type}. Use: cases, movements, publications, documents` }, 400);
  }
}

// ─── DELETE handler: remove data ───
async function handleDelete(req: Request) {
  const auth = await validateApiKey(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { tenantId, supabase } = auth;

  const body = await req.json();
  const { type, ids } = body;

  if (!type || !ids || !Array.isArray(ids) || ids.length === 0) {
    return json({ error: "Body must have 'type' (movements|documents|publications) and 'ids' (array of UUIDs)" }, 400);
  }

  if (ids.length > 100) {
    return json({ error: "Maximum 100 IDs per request" }, 400);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const invalidIds = ids.filter((id: string) => !uuidRegex.test(id));
  if (invalidIds.length > 0) {
    return json({ error: `Invalid UUID format: ${invalidIds.join(", ")}` }, 400);
  }

  const results: any = { type, deleted: 0, errors: [] };

  switch (type) {
    case "movements": {
      // Verify tenant ownership via cases join
      const { data: tenantCases } = await supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenantId);
      const caseIds = (tenantCases || []).map((c: any) => c.id);

      if (caseIds.length === 0) {
        return json({ error: "No cases found for your tenant" }, 404);
      }

      const { data: toDelete } = await supabase
        .from("movements")
        .select("id")
        .in("id", ids)
        .in("case_id", caseIds);

      const validIds = (toDelete || []).map((m: any) => m.id);
      const skipped = ids.filter((id: string) => !validIds.includes(id));

      if (skipped.length > 0) {
        results.errors.push({ skipped, reason: "Not found or not in your tenant" });
      }

      if (validIds.length > 0) {
        const { error } = await supabase
          .from("movements")
          .delete()
          .in("id", validIds);
        if (error) results.errors.push({ error: error.message });
        else results.deleted = validIds.length;
      }
      break;
    }

    case "documents": {
      const { data: toDelete } = await supabase
        .from("documents")
        .select("id, case_id")
        .in("id", ids);

      // Verify tenant via cases
      const caseIdsToCheck = [...new Set((toDelete || []).map((d: any) => d.case_id))];
      const { data: tenantCases } = await supabase
        .from("cases")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("id", caseIdsToCheck);
      const validCaseIds = (tenantCases || []).map((c: any) => c.id);
      const validIds = (toDelete || []).filter((d: any) => validCaseIds.includes(d.case_id)).map((d: any) => d.id);

      const skipped = ids.filter((id: string) => !validIds.includes(id));
      if (skipped.length > 0) {
        results.errors.push({ skipped, reason: "Not found or not in your tenant" });
      }

      if (validIds.length > 0) {
        const { error } = await supabase.from("documents").delete().in("id", validIds);
        if (error) results.errors.push({ error: error.message });
        else results.deleted = validIds.length;
      }
      break;
    }

    case "publications": {
      const { data: toDelete } = await supabase
        .from("dje_publications")
        .select("id")
        .in("id", ids)
        .eq("tenant_id", tenantId);

      const validIds = (toDelete || []).map((p: any) => p.id);
      const skipped = ids.filter((id: string) => !validIds.includes(id));

      if (skipped.length > 0) {
        results.errors.push({ skipped, reason: "Not found or not in your tenant" });
      }

      if (validIds.length > 0) {
        const { error } = await supabase.from("dje_publications").delete().in("id", validIds);
        if (error) results.errors.push({ error: error.message });
        else results.deleted = validIds.length;
      }
      break;
    }

    default:
      return json({ error: `Unknown type: ${type}. Use: movements, documents, publications` }, 400);
  }

  return json({ success: true, ...results });
}

// ─── POST handler: ingest data (existing) ───
async function handlePost(req: Request) {
  const auth = await validateApiKey(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { tenantId, supabase } = auth;

  const encoder = new TextEncoder();
  const body = await req.json();
  const { type, data: payload } = body;

  if (!type || !payload) {
    return json({ error: "Body must have 'type' and 'data' fields" }, 400);
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
        const uHash = Array.from(new Uint8Array(hBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

        const { error } = await supabase.from("movements").upsert(
          {
            case_id: item.case_id,
            title: item.title,
            details: item.details || null,
            occurred_at: item.occurred_at,
            source_label: item.source_label || "API",
            unique_hash: uHash,
          },
          { onConflict: "unique_hash" }
        );

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
        const { data: existing } = await supabase
          .from("cases")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("process_number", item.process_number)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("cases")
            .update({
              parties: item.parties || undefined,
              subject: item.subject || undefined,
              case_summary: item.case_summary || undefined,
            })
            .eq("id", existing.id);
          if (error) results.errors.push({ item: item.process_number, error: error.message });
          else results.processed++;
        } else {
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
        const uHash = Array.from(new Uint8Array(hBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

        const { error } = await supabase.from("dje_publications").upsert(
          {
            tenant_id: tenantId,
            oab_number: item.oab_number,
            title: item.title,
            content: item.content || null,
            publication_date: item.publication_date,
            source: item.source || "api",
            unique_hash: uHash,
            process_number: item.process_number || null,
            organ: item.organ || null,
          },
          { onConflict: "unique_hash" }
        );

        if (error) results.errors.push({ item: item.title, error: error.message });
        else results.processed++;
      }
      break;
    }

    default:
      return json({ error: `Unknown type: ${type}. Use: movements, processes, documents, publications` }, 400);
  }

  return json({ success: true, ...results });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method === "GET") return await handleGet(req);
    if (req.method === "POST") return await handlePost(req);
    if (req.method === "DELETE") return await handleDelete(req);
    return json({ error: "Method not allowed. Use GET (read), POST (ingest), or DELETE (remove)" }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

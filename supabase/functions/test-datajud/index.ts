import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const raw = Deno.env.get("DATAJUD_API_KEY") || "";
  const apiKey = raw.replace(/^APIKey\s+/i, "").trim();

  const results: Record<string, unknown>[] = [];

  // Test 1: POST with raw number (current approach)
  // Test 2: GET with raw number (as per official docs - curl uses -XGET)
  // Test 3: POST with the exact example from CNJ docs (TRF1)

  const tests = [
    {
      label: "CNJ example TRF1 (POST)",
      method: "POST",
      endpoint: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
      number: "00008323520184013202",
    },
    {
      label: "CNJ example TRF1 (GET)",
      method: "GET",
      endpoint: "https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search",
      number: "00008323520184013202",
    },
    {
      label: "User TJRS (POST)",
      method: "POST",
      endpoint: "https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search",
      number: "50001779420268210101",
    },
    {
      label: "User TRF4 (POST)",
      method: "POST",
      endpoint: "https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search",
      number: "50013639320264047107",
    },
  ];

  for (const test of tests) {
    try {
      const body = JSON.stringify({
        query: { match: { numeroProcesso: test.number } },
      });

      const response = await fetch(test.endpoint, {
        method: test.method,
        headers: {
          Authorization: `APIKey ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(test.method === "POST" ? { body } : {}),
      });

      const contentType = response.headers.get("content-type") || "";
      const responseText = await response.text();

      let parsed: any = null;
      try { parsed = JSON.parse(responseText); } catch {}

      results.push({
        label: test.label,
        method: test.method,
        status: response.status,
        contentType,
        totalHits: parsed?.hits?.total?.value ?? "N/A",
        responsePreview: responseText.substring(0, 500),
      });
    } catch (err) {
      results.push({
        label: test.label,
        error: (err as Error).message,
      });
    }
  }

  return new Response(JSON.stringify({ apiKeyLen: apiKey.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

// Proxies requests to USDA FoodData Central, injecting the API key from a
// server-side secret (set via Supabase: Edge Functions -> Manage secrets,
// or `supabase secrets set USDA_API_KEY=...`) instead of shipping it in
// client code. See calorie-counter/SETUP.md for why that matters on a
// GitHub-Pages-hosted, no-build-step app: anything in src/config.js is
// plain text in a public repo, and USDA/GitHub's own secret scanning
// revokes a key within minutes of it being pushed.
//
// Forwards whatever { path, method, body } the client sends (see
// src/sources/usda.js) rather than hardcoding one endpoint, so this one
// function covers both /foods/search and /food/{fdcId}.

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("USDA_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "USDA_API_KEY secret is not set on this project" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let path, method, body;
  try {
    ({ path, method = "GET", body } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (typeof path !== "string" || !path.startsWith("/")) {
    return new Response(JSON.stringify({ error: "path must start with /" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(`${USDA_BASE}${path}?api_key=${apiKey}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

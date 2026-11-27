// Reads a nutrition-facts label photo and extracts structured macros via
// Claude's vision, so a product with no barcode/database entry (a store
// brand, a homemade dish's printed label, etc.) can be logged accurately
// without typing every number off the label by hand. The Anthropic key
// lives here as a server-side secret (set via Supabase: Edge Functions ->
// Manage secrets, or `supabase secrets set ANTHROPIC_API_KEY=...`) — same
// reasoning as usda-proxy: it never ships to the client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTRACTION_PROMPT = `You are reading a food Nutrition Facts label from a photo. Extract the following as a JSON object, with no other text before or after it:
{
  "name": string (the food/product name if visible, else a short plain description of the food),
  "quantity_label": string (the serving size exactly as printed, e.g. "4 Cookies (29g)"),
  "kcal": number (calories per serving),
  "protein_g": number (protein grams per serving),
  "carbs_g": number (total carbohydrate grams per serving),
  "fat_g": number (total fat grams per serving),
  "fiber_g": number (dietary fiber grams per serving, 0 if not listed)
}
If a value isn't visible or legible, make your best reasonable estimate rather than omitting the field. Respond with ONLY the JSON object, nothing else.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY secret is not set on this project" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let image, mediaType;
  try {
    ({ image, media_type: mediaType } = await req.json());
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (typeof image !== "string" || !image) {
    return new Response(JSON.stringify({ error: "Missing image" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: data?.error?.message || `Anthropic API error: ${upstream.status}` }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = (data?.content || []).find((b: { type: string }) => b.type === "text")?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Couldn't read a nutrition label from that photo" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return new Response(JSON.stringify({ error: "Couldn't read a nutrition label from that photo" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

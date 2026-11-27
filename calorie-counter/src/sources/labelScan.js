import { supabase } from "../supabaseClient.js";

// Reads a nutrition-facts label photo via the "nutrition-label-proxy"
// Supabase Edge Function (Claude's vision, server-side — the Anthropic
// key never ships to the client, same reasoning as usda.js's proxy).
// Returns the extracted fields as-is; the caller is responsible for
// letting the person review/correct them before logging, since a
// misread label (a blurry photo, an odd layout) is possible and this is
// never auto-logged without a look. Throws in local mode, same as any
// other network call there — callers already treat that as "not
// available right now" rather than something to special-case.
export async function scanNutritionLabel(base64Image, mediaType) {
  const { data, error } = await supabase.functions.invoke("nutrition-label-proxy", {
    body: { image: base64Image, media_type: mediaType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

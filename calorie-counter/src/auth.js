import { supabase } from "./supabaseClient.js";

export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data }) => callback(data.session));
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

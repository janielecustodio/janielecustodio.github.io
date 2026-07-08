import { supabase } from "./supabaseClient.js";

export function onAuthChange(callback) {
  supabase.auth.getSession().then(({ data }) => callback(data.session));
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// Sends a 6-digit code to `email`. `shouldCreateUser: true` means the first
// request creates your account; disable "Allow new users to sign up" in
// Supabase Auth settings afterwards so no one else can do the same.
export async function requestOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyOtp(email, code) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}

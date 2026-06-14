import { supabaseAdmin } from "../supabase.js";

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = authHeader.slice(7);

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Your sign-in session is no longer valid. Please sign out and sign in again." });
  }

  req.user = {
    sub: data.user.id,
    email: data.user.email
  };

  return next();
}

export async function requireAdmin(req, res, next) {
  if (!req.user?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", req.user.sub)
    .single();

  if (error) {
    return res.status(500).json({ error: "Could not check role" });
  }

  if (data?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

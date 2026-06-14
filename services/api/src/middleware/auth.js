import jwt from "jsonwebtoken";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

if (!jwtSecret) {
  throw new Error("Missing SUPABASE_JWT_SECRET");
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireAdmin(req, res, next) {
  if (!req.user?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { supabaseAdmin } = await import("../supabase.js");
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

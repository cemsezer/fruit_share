import { Router } from "express";

import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

router.post("/listings/:id/flag", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("listings").update({ status: "flagged" }).eq("id", id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true, status: "flagged" });
});

router.post("/listings/:id/remove", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("listings").update({ status: "removed" }).eq("id", id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true, status: "removed" });
});

export default router;

import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  address_text: z.string().trim().max(240).nullable().optional(),
  address_lat: z.number().min(-90).max(90).nullable().optional(),
  address_lng: z.number().min(-180).max(180).nullable().optional(),
  collection_view: z.enum(["all", "nearby"]),
  collection_radius_km: z.number().min(1).max(100).nullable().optional()
});

const profileSelect = "id,email,display_name,address_text,address_lat,address_lng,collection_view,collection_radius_km";

router.get("/me", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(profileSelect)
    .eq("id", req.user.sub)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ profile: data });
});

router.put("/me", requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;

  if ((payload.address_lat == null) !== (payload.address_lng == null)) {
    return res.status(400).json({ error: "address_lat and address_lng must be provided together" });
  }

  if (payload.collection_view === "nearby" && payload.collection_radius_km == null) {
    return res.status(400).json({ error: "Choose a radius for nearby collections" });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      display_name: payload.display_name,
      address_text: payload.address_text || null,
      address_lat: payload.address_lat ?? null,
      address_lng: payload.address_lng ?? null,
      collection_view: payload.collection_view,
      collection_radius_km: payload.collection_radius_km ?? null
    })
    .eq("id", req.user.sub)
    .select(profileSelect)
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ profile: data });
});

export default router;
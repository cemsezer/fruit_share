import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

const listingSchema = z.object({
  title: z.string().min(3).max(140),
  category: z.enum(["Fruit", "Vegetable", "Herbs", "Other"]),
  description: z.string().max(500).optional().default(""),
  quantity_note: z.string().max(100).optional().default(""),
  available_from: z.string().datetime(),
  available_until: z.string().datetime(),
  location_lat: z.number().min(-90).max(90),
  location_lng: z.number().min(-180).max(180)
});

router.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("id,owner_id,title,category,description,quantity_note,available_from,available_until,location_lat,location_lng,status,created_at")
    .eq("status", "active")
    .gte("available_until", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ listings: data ?? [] });
});

router.post("/", requireAuth, async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  if (new Date(payload.available_until) <= new Date(payload.available_from)) {
    return res.status(400).json({ error: "available_until must be later than available_from" });
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .insert({
      owner_id: req.user.sub,
      ...payload
    })
    .select("id")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ listing: data });
});

router.post("/:id/requests", requireAuth, async (req, res) => {
  const listingId = req.params.id;

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, owner_id, status")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.status !== "active") {
    return res.status(400).json({ error: "Listing is not available" });
  }

  if (listing.owner_id === req.user.sub) {
    return res.status(400).json({ error: "Owner cannot request own listing" });
  }

  const { data, error } = await supabaseAdmin
    .from("collection_requests")
    .insert({
      listing_id: listingId,
      requester_id: req.user.sub,
      status: "pending"
    })
    .select("id,status")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ request: data });
});

export default router;

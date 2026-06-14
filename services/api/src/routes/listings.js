import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

const dateTimeSchema = z.string().datetime({ offset: true });

const listingSchema = z.object({
  title: z.string().min(3).max(140),
  category: z.enum(["Fruit", "Vegetable", "Herbs", "Other"]),
  description: z.string().max(500).optional().default(""),
  quantity_note: z.string().max(100).optional().default(""),
  available_from: dateTimeSchema,
  available_until: dateTimeSchema.nullable().optional(),
  pickup_area: z.string().min(2).max(160),
  location_lat: z.number().min(-90).max(90).nullable().optional(),
  location_lng: z.number().min(-180).max(180).nullable().optional()
});

router.get("/", async (_req, res) => {
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("id,owner_id,title,category,description,quantity_note,available_from,available_until,pickup_area,location_lat,location_lng,status,created_at")
    .eq("status", "active")
    .gte("created_at", recentCutoff)
    .or(`available_until.is.null,available_until.gte.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ listings: data ?? [] });
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("listings")
    .select("id,owner_id,title,category,description,quantity_note,available_from,available_until,pickup_area,location_lat,location_lng,status,created_at")
    .eq("owner_id", req.user.sub)
    .neq("status", "removed")
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
  if (payload.available_until && new Date(payload.available_until) <= new Date(payload.available_from)) {
    return res.status(400).json({ error: "available_until must be later than available_from" });
  }

  if ((payload.location_lat == null) !== (payload.location_lng == null)) {
    return res.status(400).json({ error: "location_lat and location_lng must be provided together" });
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

router.put("/:id", requireAuth, async (req, res) => {
  const listingId = req.params.id;
  const parsed = listingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const payload = parsed.data;
  if (payload.available_until && new Date(payload.available_until) <= new Date(payload.available_from)) {
    return res.status(400).json({ error: "available_until must be later than available_from" });
  }

  if ((payload.location_lat == null) !== (payload.location_lng == null)) {
    return res.status(400).json({ error: "location_lat and location_lng must be provided together" });
  }

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.owner_id !== req.user.sub) {
    return res.status(403).json({ error: "Only the listing owner can edit this listing" });
  }

  const { data, error } = await supabaseAdmin
    .from("listings")
    .update(payload)
    .eq("id", listingId)
    .select("id")
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ listing: data });
});

router.delete("/:id", requireAuth, async (req, res) => {
  const listingId = req.params.id;

  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .single();

  if (listingError || !listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.owner_id !== req.user.sub) {
    return res.status(403).json({ error: "Only the listing owner can delete this listing" });
  }

  const { error } = await supabaseAdmin
    .from("listings")
    .update({ status: "removed" })
    .eq("id", listingId);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ ok: true });
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

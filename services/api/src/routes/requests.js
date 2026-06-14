import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../supabase.js";

const router = Router();

const respondSchema = z.object({
  decision: z.enum(["accepted", "rejected"])
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("collection_requests")
    .select("id,status,created_at,listings(id,title,category,pickup_area,available_from,available_until,status,owner_id)")
    .eq("requester_id", req.user.sub)
    .order("created_at", { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({ requests: data ?? [] });
});

router.post("/:id/respond", requireAuth, async (req, res) => {
  const requestId = req.params.id;
  const parsed = respondSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { data: request, error: requestError } = await supabaseAdmin
    .from("collection_requests")
    .select("id,listing_id,requester_id,status,listings(owner_id)")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return res.status(404).json({ error: "Request not found" });
  }

  if (request.listings?.owner_id !== req.user.sub) {
    return res.status(403).json({ error: "Only listing owner can respond" });
  }

  if (request.status !== "pending") {
    return res.status(400).json({ error: "Request already handled" });
  }

  const nextStatus = parsed.data.decision;

  const { error: updateRequestError } = await supabaseAdmin
    .from("collection_requests")
    .update({ status: nextStatus })
    .eq("id", requestId);

  if (updateRequestError) {
    return res.status(500).json({ error: updateRequestError.message });
  }

  if (nextStatus === "accepted") {
    const { error: listingUpdateError } = await supabaseAdmin
      .from("listings")
      .update({ status: "reserved" })
      .eq("id", request.listing_id);

    if (listingUpdateError) {
      return res.status(500).json({ error: listingUpdateError.message });
    }
  }

  return res.json({ ok: true, status: nextStatus });
});

export default router;

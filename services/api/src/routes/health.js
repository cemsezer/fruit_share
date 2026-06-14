import { Router } from "express";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "fruit-share-api", date: new Date().toISOString() });
});

export default router;

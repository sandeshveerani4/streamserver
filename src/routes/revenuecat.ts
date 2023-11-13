import { Router } from "express";

const router = Router({ mergeParams: true });

router.post("/", async (req, res) => {
  return res.json({ response: req });
});

export default router;

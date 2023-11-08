import { Router } from "express";
import { requireAuth } from "../middleware";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createWorker } from "tesseract.js";

const router = Router({ mergeParams: true });

router.post("/", (req, res) => {
  console.log(req.files);
  return res.json({ success: true });
});

export default router;

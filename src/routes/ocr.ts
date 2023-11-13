import { Router } from "express";
import { requireAuth } from "../middleware";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createWorker } from "tesseract.js";
import { UploadedFile } from "express-fileupload";

const router = Router({ mergeParams: true });

router.post("/", async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({ error: "invalid_file_count" });
  }
  let file = req.files["image"];
  const worker = await createWorker("eng");
  const ret = await worker.recognize((file as UploadedFile).data);
  await worker.terminate();
  return res.json({ response: ret.data.text });
});

export default router;

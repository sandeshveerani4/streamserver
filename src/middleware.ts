import admin from "firebase-admin";
import { IncomingMessage } from "http";
import { NextFunction, Request, Response } from "express";
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(req.headers);
  const uid = req.headers["x-firebase-uid"];
  const userToken = req.headers["x-firebase-token"];
  if (!uid || !userToken) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  const uToken = await admin.auth().verifyIdToken(userToken as string);
  if (!(uToken && uToken.uid === uid)) {
    res.status(401).json({ error: "unauthorized" });
    return false;
  }
  req.uid = uid;
  next();
  return true;
};

export const requireTokenWs = async (req: IncomingMessage) => {
  const uid = req.headers["x-firebase-uid"] ?? req.headers["X-Firebase-UID"];
  const userToken =
    req.headers["x-firebase-token"] ?? req.headers["X-Firebase-Token"];
  if (!uid || !userToken) {
    return false;
  }
  const uToken = await admin.auth().verifyIdToken(userToken as string);
  if (!(uToken && uToken.uid === uid)) {
    return false;
  }
  return true;
};

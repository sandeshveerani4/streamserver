import admin from "firebase-admin";
import { IncomingMessage } from "http";

export const requireTokenWs = async (req: IncomingMessage) => {
  const uid = req.headers["x-firebase-uid"];
  const userToken = req.headers["x-firebase-token"];
  if (!uid || !userToken) {
    return false;
  }
  const uToken = await admin.auth().verifyIdToken(userToken as string);
  if (!(uToken && uToken.uid === uid)) {
    return false;
  }
  return true;
};

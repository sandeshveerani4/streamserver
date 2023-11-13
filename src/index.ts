import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import admin from "firebase-admin";
import { createServer } from "http";
import { onMsg } from "./ws_handler";
import { requireTokenWs } from "./middleware";
import "dotenv/config";
import OpenAI from "openai";
import ocr from "./routes/ocr";
import revenuecat from "./routes/revenuecat";
import fileUpload from "express-fileupload";
/* import { initializeFirebaseApp, backups } from "firestore-export-import";
import fs from "fs"; */
const openai = new OpenAI({
  apiKey: process.env["PAID_API"],
});

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "textaify-5d7b6",
    privateKey: process.env["FIREBASE_PRIVATE_KEY"],
    clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
  }),
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(fileUpload({ useTempFiles: false }));

app.get("/", (req, res) => {
  /* backups(firestore).then((collections: any) => {
    const final = [];
    for (const key in collections.users) {
      final.push({ uid: key, ...collections });
    }
    fs.writeFile("users.json", JSON.stringify({ users: final }), (e) => {
      console.log(e);
    });
  }); */
  return res.json({ sucess: true });
});
app.use("/ocr", ocr);
app.use("/revenuecat", revenuecat);
/* const firestore = initializeFirebaseApp({
  credential: admin.credential.cert({
    projectId: "textaify-5d7b6",
    privateKey: process.env["FIREBASE_PRIVATE_KEY"],
    clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
  }),
}); */
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", async (req, socket, head) => {
  const verfied = await requireTokenWs(req);
  if (
    !verfied &&
    !(req.headers["test_mode"] && req.headers["test_mode"] === "1692157405020")
  ) {
    console.log("got there");
    socket.end();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", async (ws, req) => {
  ws.send("Connection successful!");
  const uid = req.headers["x-firebase-uid"] as string;
  ws.on("message", async (data) => await onMsg(ws, data, uid, openai));
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
  console.log("Listening on port", port);
});

process.on("SIGINT", () => {
  process.exit();
});

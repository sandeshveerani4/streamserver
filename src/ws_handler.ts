import { RawData, WebSocket } from "ws";
import admin from "firebase-admin";
import axios from "axios";
import { encode } from "gpt-3-encoder";
import OpenAI from "openai";
import { ChatCompletionMessage } from "openai/resources";

export async function onMsg(
  ws: WebSocket,
  message: RawData,
  uid: string,
  openai: OpenAI
) {
  const body = JSON.parse(message as unknown as string);
  const document = admin.firestore().collection("users").doc(uid);
  const dbResults = await document.get();
  let finalData = dbResults.data();
  const currentTimeStamp = admin.firestore.Timestamp.now();
  if (!finalData) {
    ws.send(
      JSON.stringify({
        error: "User not Found!",
      })
    );
    return ws.close();
  }
  if (!finalData["renewed"]) {
    const newTimeStamp = admin.firestore.Timestamp.fromDate(
      new Date(2022, 11, 24)
    );
    document.update({
      renewed: newTimeStamp,
      createdAt: newTimeStamp,
    });
  }
  if (!finalData["availableTokens"]) {
    const availableTokens = (
      await admin.database().ref("/free_tokens").once("value")
    ).val();
    document.update({
      availableTokens: availableTokens,
    });
    finalData["availableTokens"] = availableTokens;
  }
  if (finalData["tokens"] >= finalData["availableTokens"]) {
    ws.send(
      JSON.stringify({
        error:
          "Tokens limit exceeded. Upgrade to PRO or Subscribe to higher Plan to continue using AiFy!",
      })
    );
    return ws.close();
  }

  let newdata: OpenAI.Chat.ChatCompletionCreateParams = {
    max_tokens: parseInt(body["max_tokens"]),
    model: "gpt-3.5-turbo",
    messages: [] as ChatCompletionMessage[],
    n: 1,
    temperature: 0.3,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: true,
  };

  if (newdata["max_tokens"] && newdata["max_tokens"] >= 1200) {
    newdata["max_tokens"] = 1200;
  }
  if (body?.prompt) {
    newdata["messages"] = [
      ...newdata.messages,
      { role: "user", content: body.prompt },
    ];
  } else {
    if (newdata["messages"][0]?.role !== "system") {
      newdata.messages = [
        {
          role: "system",
          content:
            "You are a helpful assistant named 'AiFy'." +
            ((body?.modeDetail ?? "") + (body?.sentiment ?? "")),
        },
      ];
    }
    newdata["messages"] = [...newdata.messages, ...body?.messages];
  }
  const stream = await openai.beta.chat.completions.stream(newdata);
  stream.on("chunk", (chunk) => {
    ws.send(JSON.stringify(chunk));
  });
  stream.on("totalUsage", (usage) => {
    document.update({
      tokens: usage.total_tokens,
      lastTokensUsed: currentTimeStamp,
    });
  });
  stream.on("error", (error) => {
    ws.send(JSON.stringify({ error: error.message, name: error.name }));
    ws.close();
  });
  stream.on("end", () => {
    ws.send("[DONE]");
    ws.close();
  });
}

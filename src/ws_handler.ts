import { RawData, WebSocket } from "ws";
import admin from "firebase-admin";
import axios from "axios";
import { encode } from "gpt-3-encoder";
import OpenAI from "openai";
import { ChatCompletionMessage } from "openai/resources";

const handleOldUsers = async (
  document: admin.firestore.DocumentReference<admin.firestore.DocumentData>,
  finalData: admin.firestore.DocumentData
) => {
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
};

export async function onMsg(
  ws: WebSocket,
  message: RawData,
  uid: string,
  openai: OpenAI
) {
  const body: OpenAI.Chat.ChatCompletionCreateParamsStreaming = JSON.parse(
    message as unknown as string
  );
  const document = admin.firestore().collection("users").doc(uid);
  const dbResults = await document.get();
  let finalData = dbResults.data();
  const currentTimeStamp = admin.firestore.Timestamp.now();
  if (finalData === undefined) {
    ws.send(
      JSON.stringify({
        error: "User not Found!",
      })
    );
    return ws.close();
  }

  handleOldUsers(document, finalData);

  if (finalData["tokens"] >= finalData["availableTokens"]) {
    ws.send(
      JSON.stringify({
        error:
          "Tokens limit exceeded. Upgrade to PRO or Subscribe to higher Plan to continue using AiFy!",
      })
    );
    return ws.close();
  }

  let newdata: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
    max_tokens: body["max_tokens"],
    model: "gpt-3.5-turbo",
    messages: [] as ChatCompletionMessage[],
    n: 1,
    temperature: 0.3,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: true,
  };

  newdata = { ...newdata, ...body };
  let tokens = 0;

  const stream = await openai.beta.chat.completions.stream(newdata);

  const updateTokens = () => {
    document.update({
      tokens: tokens,
      lastTokensUsed: currentTimeStamp,
    });
  };

  stream.on("content", (delta) => {
    tokens += encode(delta).length;
  });

  stream.on("chunk", (chunk) => {
    ws.send(JSON.stringify(chunk));
    if (
      finalData &&
      tokens + finalData["tokens"] > finalData["available_tokens"]
    ) {
      stream.abort();
      ws.send(
        JSON.stringify({
          error:
            "Tokens limit exceeded. Upgrade to PRO or Subscribe to higher Plan to continue using AiFy!",
        })
      );
      ws.close();
    }
  });

  stream.on("error", (error) => {
    tokens !== 0 && updateTokens();
    console.error(error.stack);
    ws.send(JSON.stringify({ error: error.message, name: error.name }));
    ws.close();
  });

  stream.on("end", () => {
    tokens !== 0 && updateTokens();
    ws.send("[DONE]");
    ws.close();
  });
}

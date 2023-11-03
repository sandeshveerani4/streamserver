import { RawData, WebSocket } from "ws";
import admin from "firebase-admin";
import axios from "axios";
import { encode } from "gpt-3-encoder";

export async function onMsg(ws: WebSocket, message: RawData, uid: string) {
  const body = JSON.parse(message as unknown as string);
  const document = admin.firestore().collection("users").doc(uid);
  const dbResults = await document.get();
  let finalData = dbResults.data();
  const currentTimeStamp = admin.firestore.Timestamp.now();
  if (!finalData) {
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
  if (finalData["tokens"] < finalData["availableTokens"]) {
    // const pnrs = finalData["plan"] == "free" ? await pnrKey() : null;
    try {
      let newdata = {
        max_tokens: parseInt(body["max_tokens"]),
        model: "gpt-3.5-turbo",
        messages: [] as { role: string; content: string }[],
        n: 1,
        temperature: 0.3,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: true,
      };

      if (newdata["max_tokens"] >= 1200) {
        newdata["max_tokens"] = 1200;
      }
      if (body?.prompt) {
        newdata["messages"] = [
          ...newdata.messages,
          { role: "user", content: body.prompt },
        ];
      } else {
        if (newdata["messages"][0]?.role != "system") {
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
      var total_tokens = 0;
      // process.env[finalData["plan"] == "free" ? pnrs.api : "PAID_API"]
      await axios
        .post("https://api.openai.com/v1/chat/completions", newdata, {
          headers: {
            "Content-Type": "application/json",
            "Acess-Control-Allow-Origin": "*",
            Authorization: `Bearer ${process.env["PAID_API"]}`,
          },
          responseType: "stream",
        })
        .then(async (response) => {
          response.data.on("data", async (chunk: string) => {
            const lines = chunk
              ?.toString()
              ?.split("\n")
              .filter((line) => line.trim() !== "");
            for (const line of lines) {
              const message = line.replace(/^data: /, "");
              ws.send(message);
              if (finalData && message === "[DONE]") {
                document.update({
                  tokens: finalData["tokens"] + total_tokens,
                  lastTokensUsed: currentTimeStamp,
                });
                break;
              }
              try {
                const parsed = JSON.parse(message);
                if (parsed.choices[0].delta.content) {
                  total_tokens += encode(
                    parsed.choices[0].delta.content
                  ).length;
                }
              } catch {}
            }
          });

          response.data.on("end", async () => {
            ws.close();
          });
        })
        .catch(async (error) => {
          console.log(error);
          ws.send(
            JSON.stringify({
              error:
                `AiFy is its peak. ${
                  finalData?.plan === "free"
                    ? "Upgrade to PRO to avoid such errors. "
                    : ""
                }Error details:` + (error.response?.statusText ?? " Retry."),
            })
          );
          ws.close();
        });
    } catch (error: any) {
      if (error.response) {
        ws.send(
          JSON.stringify({
            error:
              error.response.data.error.message ??
              JSON.stringify(error.response.data),
          })
        );
        ws.close();
      } else {
        ws.send(JSON.stringify({ error: error.message }));
        ws.close();
      }
    }
  } else {
    ws.send(
      JSON.stringify({
        error:
          "Tokens limit exceeded. Upgrade to PRO or Subscribe to higher Plan to continue using AiFy!",
      })
    );
    ws.close();
  }
}

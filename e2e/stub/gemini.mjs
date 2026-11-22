// A local stand-in for the Gemini API (`generateContent`), for the signed-in Playwright suite only.
// The app reaches it through GEMINI_TEST_BASE (loopback only). Its mode is set per test with
// POST /gemini/mode {"mode": "ok" | "slow" | "down"}: "slow" answers after 20 s (design 10.8's
// LCP check), "down" answers 503. The plan reply words only the home tip and Help the air; Breezy
// and the community message get short replies the app's validator accepts.
const SLOW_MS = 20_000;
let mode = "ok";

const both = (languages, en, hi) => Object.fromEntries(languages.map((l) => [l, l === "en" ? en : hi]));

function planReply(input) {
  const text = (en, hi) => both(input.languages, en, hi);
  return {
    members: [],
    home: input.allowedTips
      .slice(0, 1)
      .map((tipId) => ({ tipId, doThis: text("Keep the windows shut this morning.", "आज सुबह खिड़कियाँ बंद रखें।") })),
    together: { altId: input.together, doThis: text("No burning of leaves or rubbish today.", "आज पत्ते या कचरा न जलाएँ।") },
  };
}

/** The prompt text from the SDK's request body. */
const promptOf = (body) => body.contents?.[0]?.parts?.[0]?.text ?? "";

/** The prompt's input JSON: the first paragraph after its label (Breezy adds fenced user text after it). */
const inputOf = (prompt) => JSON.parse(prompt.split("\n\n")[0].slice(prompt.indexOf("{")));

/**
 * Breezy: one checklist card for the first person named in the question (a dependent gets an item
 * that passes the kid-card checks, an adult a health reminder), or no person ("Who is this for?").
 */
function breezyReply(prompt) {
  const input = inputOf(prompt);
  const question = prompt.slice(prompt.indexOf("<user_question>"));
  const token = question.match(/\{([md]\d+)\}/)?.[1] ?? null;
  const kid = token?.startsWith("d");
  const item = kid
    ? { en: "Carry your water bottle", hi: "पानी की बोतल साथ रखें" }
    : { en: "Check the inhaler refill today", hi: "आज इनहेलर की रिफ़िल देखें" };
  const hindi = input.viewerLanguage === "hi";
  return {
    reply: { text: hindi ? "यह याद रखने के लिए एक सुझाव है।" : "Here's a reminder for the checklist.", lang: input.viewerLanguage },
    cards: [
      {
        title: hindi ? "याद रखें" : "A reminder",
        forMemberId: token,
        date: "today",
        time: null,
        activityType: null,
        why: "",
        factId: null,
        action: "add_checklist",
        item,
      },
    ],
    refusal: null,
  };
}

/** The community message: three short lines and the together words, in both languages. */
const communityReply = () => ({
  en: {
    title: "Smog morning",
    body: "Good morning, everyone. Keep morning walks indoors today.",
    together: "no leaf or garbage burning in our society.",
  },
  hi: { title: "आज सुबह धुंध है", body: "सुप्रभात। आज सुबह की सैर घर के अंदर करें।", together: "सोसाइटी में पत्ते या कचरा न जलाएँ।" },
});

function replyTo(prompt) {
  if (prompt.startsWith("Context (from the safety rules)")) return breezyReply(prompt);
  if (prompt.startsWith("Today's community message input")) return communityReply();
  return planReply(inputOf(prompt));
}

const read = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data ? JSON.parse(data) : {}));
  });

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

/** Handles /gemini/* paths; returns false for anything else. */
export async function gemini(req, res, path) {
  if (!path.startsWith("/gemini/")) return false;
  const body = await read(req);
  if (path === "/gemini/mode") {
    mode = body.mode;
    send(res, 200, { mode });
    return true;
  }
  if (mode === "down") {
    send(res, 503, { error: { code: 503, message: "stub down", status: "UNAVAILABLE" } });
    return true;
  }
  if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
  const text = JSON.stringify(replyTo(promptOf(body)));
  send(res, 200, { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] });
  return true;
}

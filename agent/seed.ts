import { writeFileSync, readFileSync } from "node:fs";

const GH_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GH_OWNER ?? "Anikethanshetty";
const REPO = process.env.GH_REPO ?? "leadfinder-state";
const BRANCH = process.env.GH_BRANCH ?? "main";

const state = JSON.parse(readFileSync(".data/agent-state.json", "utf8"));

async function putFile(path: string, body: string) {
  const content = Buffer.from(body, "utf8").toString("base64");
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `chore: init ${path}`,
      content,
      branch: BRANCH,
    }),
  });
  const data = await res.json();
  if (!res.ok && data.message?.includes("sha")) {
    // file exists, need sha for update
    return data;
  }
  return data;
}

(async () => {
  const r = await putFile("state.json", JSON.stringify(state, null, 2));
  console.log("state.json:", r.content?.path ? "created/updated ✅" : r.message);
  // verify
  const verify = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/state.json`, {
    headers: { Authorization: `token ${GH_TOKEN}` },
  });
  console.log("verify:", verify.status);
})();

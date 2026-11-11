// פרסום מתוזמן. רץ ב-GitHub Actions (workflow "Scheduled publish") כל 5 דקות.
// אם ב-repo הפרטי יש schedule.json והזמן שבו הגיע: בונה את tasks.txt מ-board.json עם אותו קוד של index.html
// (מה שמסומן לפרסום באותו רגע), כותב אותו - וזה מפעיל את שליחת הכרטיס ל-Teams - ומוחק את schedule.json.
// SCHED_TOKEN: מפתח GitHub עם Contents: Read and write על guyaros/3d-news.
// DRY_RUN=1: רק מדפיס מה היה נשלח, בלי לכתוב.
const fs = require("fs"), path = require("path");

const REPO = "guyaros/3d-news", API = `https://api.github.com/repos/${REPO}`;
const TOKEN = process.env.SCHED_TOKEN, DRY = !!process.env.DRY_RUN;
const MAX_LATE_MS = 6 * 3600 * 1000;  // איחור של יותר מ-6 שעות (למשל Actions היה מושבת) - לא שולחים כרטיס ישן

// הקוד המשותף מ-index.html (החלק שלפני "עריכה" - בלי DOM), כדי שהקובץ יהיה זהה ל"שלח ופרסם"
function buildTasksTxt(board) {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8").replace(/\r\n/g, "\n");
  const js = html.split("<script>\n")[1].split("</script>")[0];
  const core = js.split("// ---------- עריכה")[0];
  global.atob = s => Buffer.from(s, "base64").toString("binary");
  global.btoa = s => Buffer.from(s, "binary").toString("base64");
  global.BOARD = board;
  return (0, eval)(`(() => { ${core}
    if (BOARD.buckets && BOARD.buckets.length) buckets = BOARD.buckets;
    const sel = boardSelection(BOARD);
    return { has: hasContent(sel), tasks: sel.tasks.length, txt: toTasksTxt(sel) };
  })()`);
}

async function gh(p, opts = {}) {
  const r = await fetch(API + p, { ...opts, headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "3d-news-scheduler" } });
  if (!r.ok) { const b = await r.json().catch(() => ({})); const e = new Error(`${r.status} ${b.message || ""}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function read(name) {
  try { const f = await gh(`/contents/${name}?ref=main`); return { sha: f.sha, text: Buffer.from(f.content, "base64").toString("utf8") }; }
  catch (e) { if (e.status === 404) return null; throw e; }
}
const put = (name, text, message, sha) => gh(`/contents/${name}`, { method: "PUT",
  body: JSON.stringify({ message, content: Buffer.from(text, "utf8").toString("base64"), branch: "main", ...(sha ? { sha } : {}) }) });
const il = d => d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

async function fail(f, sched, error) {  // נשאר ב-schedule.json כדי שממשק הניהול יציג את הבעיה
  console.log(`::error::${error}`);
  if (!DRY) await put("schedule.json", JSON.stringify({ ...sched, error }, null, 2) + "\n", "Scheduled publish failed", f.sha);
}

async function main() {
  // בלי סוד: אזהרה בלבד (לא כישלון), כדי ש-GitHub לא ישלח מייל כל 5 דקות. הממשק מציג "עדיין לא נשלח".
  if (!TOKEN) return console.log("::warning::חסר הסוד SCHED_TOKEN (Settings > Secrets and variables > Actions). פרסום מתוזמן לא פעיל.");
  const f = await read("schedule.json");
  if (!f || !f.text.trim()) return console.log("אין פרסום מתוזמן.");
  const sched = JSON.parse(f.text), at = new Date(sched.at);
  if (sched.error) return console.log(`תזמון שנכשל קודם (${sched.error}) - ממתין שינוקה בממשק.`);
  if (isNaN(at)) return fail(f, sched, "זמן לא תקין");
  const now = Date.now();
  if (at > now) return console.log(`מתוזמן ל-${il(at)} (עוד ${Math.round((at - now) / 60000)} דקות).`);
  if (now - at > MAX_LATE_MS) return fail(f, sched, "הזמן עבר מזמן (השליחה האוטומטית לא רצה)");

  const b = await read("board.json");
  if (!b) return fail(f, sched, "board.json לא נמצא");
  const out = buildTasksTxt(JSON.parse(b.text));
  if (!out.has) return fail(f, sched, "לא סומן שום דבר לפרסום");
  console.log(`מפרסם ${out.tasks} משימות (תוזמן ל-${il(at)}).`);
  if (DRY) return console.log(out.txt);

  const cur = await read("tasks.txt");
  const date = new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" });
  // commit עם מפתח אישי (לא GITHUB_TOKEN) מפעיל את tasks.yml, שולח את הכרטיס
  await put("tasks.txt", out.txt, `Scheduled publish for ${date}`, cur && cur.sha);
  try { await gh("/contents/schedule.json", { method: "DELETE", body: JSON.stringify({ message: "Scheduled publish done", sha: f.sha, branch: "main" }) }); }
  catch (e) { console.log(`::warning::הכרטיס נשלח, אבל schedule.json לא נמחק (${e.message}). אולי התזמון שונה בינתיים.`); }
  console.log("✓ נשלח.");
}
main().catch(e => { console.log(`::error::${e.message}`); process.exit(1); });

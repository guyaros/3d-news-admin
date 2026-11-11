# 3d-news-admin

ממשק ניהול למשימות היום של צוות 3DP Support.
הדף מכיל קוד בלבד. הנתונים נשמרים ב-repository פרטי, והגישה אליהם דורשת מפתח GitHub אישי.

## פרסום מתוזמן (גרסה 7.5)

הכפתור "⏰ תזמון" שומר את הלוח וכותב `schedule.json` ב-repo הפרטי.
ה-workflow `Scheduled publish` (כאן, ב-repo הציבורי, כדי שדקות Actions לא ייספרו) רץ כל 5 דקות.
כשהזמן מגיע, `scheduler.js` בונה את `tasks.txt` מ-`board.json` עם אותו קוד של `index.html`, כותב אותו (זה שולח את הכרטיס) ומוחק את `schedule.json`.

הגדרה חד-פעמית: סוד `SCHED_TOKEN` ב-Settings > Secrets and variables > Actions של ה-repo הזה,
עם מפתח fine-grained שיש לו Contents: Read and write על `guyaros/3d-news` בלבד.

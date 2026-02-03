import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";
import random from "random";

const path = "./data.json";
const git = simpleGit();

// CLI usage:
// node index.js [year] [maxPerDay] [--push] [--remote=origin] [--branch=main] [--msg="Commit message"] [--authorName="Name"] [--authorEmail="email@example.com"] [--dry-run]
const rawArgs = process.argv.slice(2);
const flags = {};
const posArgs = [];
rawArgs.forEach((a) => {
  if (a.startsWith("--")) {
    const noPrefix = a.slice(2);
    if (noPrefix.includes("=")) {
      const [k, v] = noPrefix.split("=");
      flags[k] = v;
    } else {
      flags[noPrefix] = true;
    }
  } else {
    posArgs.push(a);
  }
});

const year = parseInt(posArgs[0], 10) || 2025;
const maxPerDay = posArgs[1] !== undefined ? Math.max(0, parseInt(posArgs[1], 10)) : 3;

const pushFlag = flags.push === true || flags.push === "true";
const remote = flags.remote || "origin";
const branch = flags.branch || "main";
const messageTemplate = flags.msg || flags.message || "Contribution";
const dryRun = flags["dry-run"] === true || flags.dryrun === true;
const authorName = flags.authorName || "RAYAN";
const authorEmail = flags.authorEmail || "rayan-saidfarah@outlook.fr";
const text = (flags.text || "RAYAN").toUpperCase();
const intensityList = (flags.intensities || "1,4,8").split(",").map((v) => Math.max(0, parseInt(v, 10) || 0));
const remoteUrl = flags["remote-url"] || flags.remoteUrl || null;

const getDatesOfYear = (y) => {
  const start = moment(`${y}-01-01`);
  const end = moment(`${y}-12-31`);
  const dates = [];
  for (const m = start.clone(); m.isSameOrBefore(end); m.add(1, "day")) {
    dates.push(m.clone());
  }
  return dates;
};

// Small 7x5 bitmap font for letters used in messages (A,N,R,Y and space)
const FONT = {
  A: [
    "01110",
    "10001",
    "10001",
    "11111",
    "10001",
    "10001",
    "10001",
  ],
  R: [
    "11110",
    "10001",
    "10001",
    "11110",
    "10100",
    "10010",
    "10001",
  ],
  Y: [
    "10001",
    "10001",
    "01010",
    "00100",
    "00100",
    "00100",
    "00100",
  ],
  N: [
    "10001",
    "11001",
    "10101",
    "10011",
    "10001",
    "10001",
    "10001",
  ],
  " ": [
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
    "00000",
  ],
};

const buildPatternFromText = (txt) => {
  const letters = txt.split("");
  const rows = 7;
  // compute total columns: sum letter widths + gaps (1 col gap)
  const letterWidth = 5;
  const gap = 1;
  const cols = letters.length * (letterWidth + gap) - gap;
  const pattern = Array.from({ length: cols }, () => Array(rows).fill(0));
  let cursor = 0;
  for (const ch of letters) {
    const glyph = FONT[ch] || FONT[" "];
    for (let c = 0; c < glyph[0].length; c++) {
      for (let r = 0; r < rows; r++) {
        pattern[cursor + c][r] = glyph[r][c] === "1" ? 1 : 0;
      }
    }
    cursor += glyph[0].length + gap;
  }
  return pattern;
};

const buildDateCommitMapFromPattern = (pattern, y) => {
  const firstSunday = moment(`${y}-01-01`).startOf("week");
  const map = new Map();
  for (let c = 0; c < pattern.length; c++) {
    for (let r = 0; r < 7; r++) {
      if (!pattern[c][r]) continue;
      const date = firstSunday.clone().add(c * 7 + r, "days");
      if (date.year() !== y) continue;
      // shade by row: top/bottom = light, next = medium, middle = dark
      let shadeIndex;
      if (r === 0 || r === 6) shadeIndex = 0;
      else if (r === 1 || r === 5) shadeIndex = 1;
      else shadeIndex = 2;
      const commitsForDay = intensityList[Math.min(shadeIndex, intensityList.length - 1)] || intensityList[intensityList.length - 1];
      const key = date.format("YYYY-MM-DD");
      map.set(key, (map.get(key) || 0) + commitsForDay);
    }
  }
  return map;
};

const commitAt = async (date) => {
  const iso = date.format();
  const msg = `${messageTemplate} - ${iso}`;

  if (dryRun) {
    console.log(`[dry-run] Would commit: ${msg}`);
    return;
  }

  const data = { date: iso };
  jsonfile.writeFileSync(path, data);
  await git.add([path]);

  const commitOpts = { "--date": iso };
  if (authorName && authorEmail) {
    commitOpts["--author"] = `${authorName} <${authorEmail}>`;
  }

  await git.commit(msg, commitOpts);
};

const commitMultipleOnDate = async (dayMoment, count) => {
  for (let i = 0; i < count; i++) {
    // spread times across the day to avoid identical timestamps
    const ts = dayMoment.clone().hour(Math.floor((i * 24) / Math.max(1, count))).minute(Math.floor(Math.random() * 60)).second(Math.floor(Math.random() * 60));
    await commitAt(ts);
  }
};

const makeCommitsForYear = async (y, maxPerDay) => {
  const dates = getDatesOfYear(y);
  console.log(`Generating commits for year ${y} (max ${maxPerDay} commits/day)`);

  let totalCommits = 0;

  if (flags.text) {
    const pattern = buildPatternFromText(text);
    const dateMap = buildDateCommitMapFromPattern(pattern, y);
    for (const [ymd, cnt] of dateMap.entries()) {
      const dayMoment = moment(ymd, 'YYYY-MM-DD');
      totalCommits += cnt;
      console.log(`Planned ${cnt} commits on ${ymd}`);
      await commitMultipleOnDate(dayMoment, cnt);
    }
  } else {
    for (const d of dates) {
      const commitsToday = random.int(0, maxPerDay);
      totalCommits += commitsToday;
      for (let i = 0; i < commitsToday; i++) {
        // add a random time so multiple commits on same day don't collide
        const ts = d.clone().hour(random.int(0, 23)).minute(random.int(0, 59)).second(random.int(0, 59));
        await commitAt(ts);
        console.log(`Committed: ${ts.format()}`);
      }
    }
  }

  if (totalCommits === 0) {
    console.log("No commits created — nothing to push.");
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] Created ${totalCommits} commits (no push).`);
    return;
  }

  if (pushFlag) {
    // if remoteUrl is provided, ensure remote exists/set to that url
    if (remoteUrl) {
      try {
        const remotes = await git.getRemotes(true);
        const existing = remotes.find((r) => r.refs.fetch === remoteUrl || r.refs.push === remoteUrl);
        if (!existing) {
          console.log(`Adding remote '${remote}' -> ${remoteUrl}`);
          try {
            await git.addRemote(remote, remoteUrl);
          } catch (err) {
            // if already exists under different name, set-url
            await git.remote(["set-url", remote, remoteUrl]);
          }
        }
      } catch (err) {
        console.warn('Could not validate/add remote:', err.message || err);
      }
    }

    console.log(`Pushing ${totalCommits} commits to ${remote}/${branch}...`);
    await git.push(remote, branch);
    console.log(`✅ Done pushing ${totalCommits} commits for ${y}`);
  } else {
    console.log(`Created ${totalCommits} commits locally. Run 'git push ${remote} ${branch}' to upload.`);
  }
};

makeCommitsForYear(year, maxPerDay).catch((err) => {
  console.error("Error making commits:", err);
  process.exit(1);
});

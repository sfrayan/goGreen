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
const authorName = flags.authorName || null;
const authorEmail = flags.authorEmail || null;

const getDatesOfYear = (y) => {
  const start = moment(`${y}-01-01`);
  const end = moment(`${y}-12-31`);
  const dates = [];
  for (const m = start.clone(); m.isSameOrBefore(end); m.add(1, "day")) {
    dates.push(m.clone());
  }
  return dates;
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

const makeCommitsForYear = async (y, maxPerDay) => {
  const dates = getDatesOfYear(y);
  console.log(`Generating commits for year ${y} (max ${maxPerDay} commits/day)`);

  let totalCommits = 0;
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

  if (totalCommits === 0) {
    console.log("No commits created — nothing to push.");
    return;
  }

  if (dryRun) {
    console.log(`[dry-run] Created ${totalCommits} commits (no push).`);
    return;
  }

  if (pushFlag) {
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

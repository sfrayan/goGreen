import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";
import random from "random";

const path = "./data.json";
const git = simpleGit();

// Usage: node index.js [year] [maxCommitsPerDay]
const year = parseInt(process.argv[2], 10) || 2025;
const maxPerDay = process.argv[3] !== undefined ? Math.max(0, parseInt(process.argv[3], 10)) : 3;

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
  const data = { date: iso };
  jsonfile.writeFileSync(path, data);
  await git.add([path]);
  // use --date to ensure commit timestamp is set
  await git.commit(iso, { "--date": iso });
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
    console.log("No commits created — skipping push.");
    return;
  }

  await git.push();
  console.log(`✅ Done pushing ${totalCommits} commits for ${y}`);
};

makeCommitsForYear(year, maxPerDay).catch((err) => {
  console.error("Error making commits:", err);
  process.exit(1);
});

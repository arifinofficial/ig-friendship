import { promises as fs } from "fs";
import {
  AccountFollowersFeedResponseUsersItem,
  AccountFollowingFeedResponseUsersItem,
  Feed,
  IgApiClient,
} from "instagram-private-api";
import prompt from "prompt";
prompt.message = "";

async function storeToJson(
  filename: string,
  data:
    | AccountFollowersFeedResponseUsersItem[]
    | AccountFollowingFeedResponseUsersItem[]
) {
  const mappedData = data.map((user) => user.username);
  const formatData = {
    fetched_at: new Date().toISOString(),
    data: mappedData,
  };
  await fs.writeFile(`./data/${filename}`, JSON.stringify(formatData, null, 2));
}

async function getAllFeedItems<T>(feed: Feed<any, T>) {
  let items: T[] = [];

  do {
    const feedItems = await feed.items();
    items = items.concat(feedItems);
  } while (feed.isMoreAvailable());

  return items;
}

async function consoleInfo(text: string) {
  console.info(
    "\x1b[44m",
    "\x1b[37m",
    "\u2139",
    "\x1b[0m",
    "\x1b[36m",
    text,
    "\x1b[0m"
  );
}

async function main() {
  try {
    consoleInfo("Setup Instagram client...");
    const { username, password }: { username: string; password: string } =
      await prompt.get([
        {
          name: "username",
          description: "username",
          required: true,
        },
        {
          name: "password",
          hidden: true,
          required: true,
        },
      ]);

    const ig = new IgApiClient();
    ig.state.generateDevice(username);
    await ig.simulate.preLoginFlow();

    consoleInfo(`Authenticating ${username} account...`);
    const loggedInUser = await ig.account.login(username, password);

    const followersFeed = ig.feed.accountFollowers(loggedInUser.pk);
    const followingFeed = ig.feed.accountFollowing(loggedInUser.pk);

    consoleInfo("Getting followers & following concurrently...");
    const [followers, following] = await Promise.all([
      getAllFeedItems<AccountFollowersFeedResponseUsersItem>(followersFeed),
      getAllFeedItems<AccountFollowingFeedResponseUsersItem>(followingFeed),
    ]);

    consoleInfo("Making a new map of followers/following username...");
    const followerUsers = new Set(followers.map(({ username }) => username));
    const followingUsers = new Set(following.map(({ username }) => username));

    consoleInfo("Checking friendship...");
    const mutual = following.filter(({ username }) =>
      followerUsers.has(username)
    );
    const notFollowbackYou = following.filter(
      ({ username }) => !followerUsers.has(username)
    );
    const notGetYourFollowback = followers.filter(
      ({ username }) => !followingUsers.has(username)
    );

    consoleInfo("Storing data into json file concurrently...");
    await Promise.all([
      storeToJson("followers.json", followers),
      storeToJson("following.json", following),
      storeToJson("mutual.json", mutual),
      storeToJson("not-followback-you.json", notFollowbackYou),
      storeToJson("not-get-your-followback.json", notGetYourFollowback),
    ]);

    consoleInfo("Counting data...");
    console.info(`+ Followers: ${followers.length}`);
    console.info(`+ Following: ${following.length}`);
    console.info(`+ Mutual: ${mutual.length}`);
    console.info(`+ Not followback you: ${notFollowbackYou.length}`);
    console.info(`+ Not get your followback: ${notGetYourFollowback.length}`);
    consoleInfo("Done!");
  } catch (error) {
    console.log(error);
  }
}

main();

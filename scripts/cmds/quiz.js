const { GoatWrapper } = require("fca-saim-x69x");
const axios = require("axios");

// Active quiz sessions: threadID -> session data
const activeSessions = new Map();

// ── Category map (OpenTDB IDs + display info) ─────────────────────────────────
const CATEGORIES = {
  general:    { id: 9,  label: "🌍 General Knowledge",     emoji: "🌍" },
  books:      { id: 10, label: "📚 Books",                  emoji: "📚" },
  film:       { id: 11, label: "🎬 Film",                   emoji: "🎬" },
  music:      { id: 12, label: "🎵 Music",                  emoji: "🎵" },
  theatre:    { id: 13, label: "🎭 Theatre",                emoji: "🎭" },
  tv:         { id: 14, label: "📺 Television",             emoji: "📺" },
  games:      { id: 15, label: "🎮 Video Games",            emoji: "🎮" },
  boardgames: { id: 16, label: "♟️ Board Games",            emoji: "♟️" },
  nature:     { id: 17, label: "🔬 Science & Nature",       emoji: "🔬" },
  computers:  { id: 18, label: "💻 Computers",              emoji: "💻" },
  maths:      { id: 19, label: "➗ Mathematics",            emoji: "➗" },
  mythology:  { id: 20, label: "⚡ Mythology",             emoji: "⚡" },
  sports:     { id: 21, label: "⚽ Sports",                 emoji: "⚽" },
  geography:  { id: 22, label: "🗺️ Geography",              emoji: "🗺️" },
  history:    { id: 23, label: "🏛️ History",                emoji: "🏛️" },
  politics:   { id: 24, label: "🏛️ Politics",               emoji: "🗳️" },
  art:        { id: 25, label: "🎨 Art",                    emoji: "🎨" },
  celebrities:{ id: 26, label: "⭐ Celebrities",            emoji: "⭐" },
  animals:    { id: 27, label: "🐾 Animals",                emoji: "🐾" },
  vehicles:   { id: 28, label: "🚗 Vehicles",               emoji: "🚗" },
  comics:     { id: 29, label: "💥 Comics",                 emoji: "💥" },
  gadgets:    { id: 30, label: "📱 Gadgets",                emoji: "📱" },
  anime:      { id: 31, label: "🍜 Anime & Manga",          emoji: "🍜" },
  cartoon:    { id: 32, label: "🐣 Cartoons & Animations",  emoji: "🐣" },
};

// ── Difficulty reward table ───────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { label: "Easy",   emoji: "🟢", reward: 2000  },
  medium: { label: "Medium", emoji: "🟡", reward: 4000  },
  hard:   { label: "Hard",   emoji: "🔴", reward: 8000  },
};

// ── Category bonus multipliers ────────────────────────────────────────────────
const CATEGORY_BONUS = {
  maths:     1.5,
  computers: 1.4,
  nature:    1.3,
  history:   1.2,
  mythology: 1.2,
  anime:     1.3,
};

function formatBalance(num) {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";
  const tiers = [
    [1e12, "trillion"], [1e9, "billion"], [1e6, "M"],
  ];
  for (const [val, suffix] of tiers) {
    if (abs >= val) {
      const divided = abs / val;
      const fmt = Number.isInteger(divided) ? divided.toString() : parseFloat(divided.toFixed(2)).toString();
      const sep = suffix.length <= 2 ? "" : " ";
      return `${sign}$${fmt}${sep}${suffix}`;
    }
  }
  return `${sign}$${abs.toLocaleString()}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Decode HTML entities from OpenTDB responses
function decode(str) {
  if (!str) return str;
  return str
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchQuestion(categoryId, difficulty) {
  // Try with category + difficulty first, then progressively relax constraints
  const urls = [
    `https://opentdb.com/api.php?amount=1&type=multiple&category=${categoryId}&difficulty=${difficulty}`,
    `https://opentdb.com/api.php?amount=1&type=multiple&category=${categoryId}`,
    `https://opentdb.com/api.php?amount=1&type=multiple&difficulty=${difficulty}`,
  ];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      const code = res.data.response_code;
      if (code === 5) {
        // Rate limited — wait and retry once
        await new Promise(r => setTimeout(r, 5000));
        const retry = await axios.get(url, { timeout: 10000 });
        if (retry.data.response_code === 0 && retry.data.results.length) return retry.data.results[0];
        continue;
      }
      if (code === 0 && res.data.results.length) return res.data.results[0];
    } catch (_) {
      continue;
    }
  }
  return null;
}

module.exports = {
  config: {
    name: "quiz",
    aliases: ["trivia"],
    version: "1.0",
    author: "CharlesMK",
    countDown: 5,
    role: 0,
    category: "game",
    description: "🧠 Answer trivia questions and win money! Choose a category and difficulty for bigger rewards.",
    usage: "quiz <category> <difficulty>\nExample: /quiz anime hard\n\nCategories: general, maths, science, anime, history, geography, sports, music, film, tv, games, computers, nature, mythology, art, animals, vehicles, comics, anime, cartoon, celebrities, politics, books, theatre, boardgames, gadgets\n\nDifficulties: easy, medium, hard"
  },

  onStart: async function ({ event, api, usersData, args, message }) {
    const threadID = event.threadID;
    const userId = event.senderID;

    // ── Block if active session in this thread ────────────────────────────────
    if (activeSessions.has(threadID)) {
      return message.reply(`⚠️ 𝐐𝐔𝐈𝐙 𝐈𝐍 𝐏𝐑𝐎𝐆𝐑𝐄𝐒𝐒\nA quiz is already running in this chat. Answer it first!`);
    }

    // ── No args: show category list ───────────────────────────────────────────
    if (!args[0]) {
      const list = Object.entries(CATEGORIES)
        .map(([k, v]) => `  ${v.emoji} ${k}`)
        .join("\n");
      return message.reply(
        `📋 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒:\n${list}\n\n` +
        `Usage: -quiz <category> <difficulty>`
      );
    }

    // ── Parse args ────────────────────────────────────────────────────────────
    const categoryKey = (args[0] || "general").toLowerCase().replace(/[^a-z]/g, "");
    const difficultyKey = (args[1] || "easy").toLowerCase();

    // Aliases
    const catAlias = {
      science: "nature", sci: "nature", math: "maths", mathematics: "maths",
      computer: "computers", tech: "computers", technology: "computers",
      movie: "film", movies: "film", video: "games", videogames: "games",
      sport: "sports", geo: "geography", myth: "mythology",
      japanese: "anime", manga: "anime", cartoon: "cartoon", cartoons: "cartoon",
      celebrity: "celebrities", animal: "animals", vehicle: "vehicles",
      comic: "comics", boardgame: "boardgames", board: "boardgames",
      gadget: "gadgets", book: "books", theatre: "theatre", theater: "theatre",
      military: "history", war: "history", politics: "politics",
    };

    const resolvedCat = catAlias[categoryKey] || categoryKey;
    const category = CATEGORIES[resolvedCat];
    const difficulty = DIFFICULTY[difficultyKey];

    if (!category) {
      const list = Object.entries(CATEGORIES).map(([k, v]) => `  ${v.emoji} ${k}`).join("\n");
      return message.reply(
        `❌ 𝐔𝐍𝐊𝐍𝐎𝐖𝐍 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐘: "${args[0] || ""}"\n\n` +
        `📋 𝐀𝐕𝐀𝐈𝐋𝐀𝐁𝐋𝐄 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒:\n${list}\n\n` +
        `Usage: +quiz <category> <difficulty>`
      );
    }

    if (!difficulty) {
      return message.reply(
        `❌ 𝐈𝐍𝐕𝐀𝐋𝐈𝐃 𝐃𝐈𝐅𝐅𝐈𝐂𝐔𝐋𝐓𝐘: "${args[1] || ""}"\n\n` +
        `🟢 easy   — $2,000\n` +
        `🟡 medium — $4,000\n` +
        `🔴 hard   — $8,000\n\n` +
        `Usage: +quiz <category> <difficulty>`
      );
    }

    // ── Calculate reward ──────────────────────────────────────────────────────
    const bonus = CATEGORY_BONUS[resolvedCat] || 1.0;
    const reward = Math.floor(difficulty.reward * bonus);

    // ── Fetch question ────────────────────────────────────────────────────────
    const loadMsg = await message.reply(`🧠 𝐋𝐎𝐀𝐃𝐈𝐍𝐆 𝐐𝐔𝐈𝐙...\nFetching a ${difficulty.label} ${category.label} question...`);
    const msgID = loadMsg.messageID;

    let questionData;
    try {
      questionData = await fetchQuestion(category.id, difficultyKey);
    } catch (e) {
      await api.editMessage(
        `❌ 𝐅𝐀𝐈𝐋𝐄𝐃 𝐓𝐎 𝐅𝐄𝐓𝐂𝐇 𝐐𝐔𝐄𝐒𝐓𝐈𝐎𝐍\nCould not reach the quiz API.\nError: ${e.message}\nTry again later.`,
        msgID
      );
      return;
    }

    if (!questionData) {
      await api.editMessage(
        `❌ 𝐍𝐎 𝐐𝐔𝐄𝐒𝐓𝐈𝐎𝐍𝐒 𝐅𝐎𝐔𝐍𝐃\nOpenTDB returned no results for ${category.label} (${difficultyKey}).\nThe API may be rate-limited — wait 5 seconds and try again.`,
        msgID
      );
      return;
    }

    const question = decode(questionData.question);
    const correct = decode(questionData.correct_answer);
    const choices = shuffle([correct, ...questionData.incorrect_answers.map(decode)]);
    const labels = ["𝐀", "𝐁", "𝐂", "𝐃"];
    const correctLabel = labels[choices.indexOf(correct)];
    const correctIndex = choices.indexOf(correct);

    const TIMEOUT_SEC = 30;

    // ── Build quiz message ────────────────────────────────────────────────────
    const choiceLines = choices.map((c, i) => `│  ${labels[i]}) ${c}`).join("\n");

    const quizBody =
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🧠 𝐐𝐔𝐈𝐙 𝐓𝐈𝐌𝐄!\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${category.emoji} 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐘: ${category.label}\n` +
      `${difficulty.emoji} 𝐃𝐈𝐅𝐅𝐈𝐂𝐔𝐋𝐓𝐘: ${difficulty.label}\n` +
      `💰 𝐑𝐄𝐖𝐀𝐑𝐃: ${formatBalance(reward)}${bonus > 1 ? ` (${bonus}× bonus!)` : ""}\n` +
      `⏰ 𝐓𝐈𝐌𝐄: ${TIMEOUT_SEC} seconds\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `❓ ${question}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${choiceLines}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Reply with 𝐀, 𝐁, 𝐂, or 𝐃`;

    await api.editMessage(quizBody, msgID);

    // ── Store session ─────────────────────────────────────────────────────────
    const timeoutHandle = setTimeout(async () => {
      if (!activeSessions.has(threadID)) return;
      activeSessions.delete(threadID);

      await api.editMessage(
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 𝐐𝐔𝐈𝐙 𝐓𝐈𝐌𝐄𝐃 𝐎𝐔𝐓!\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${category.emoji} ${category.label} | ${difficulty.emoji} ${difficulty.label}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❓ ${question}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${choiceLines}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⌛ Time's up! The answer was: ${correctLabel}) ${correct}\n` +
        `Nobody answered in time — no reward given.`,
        msgID
      );
    }, TIMEOUT_SEC * 1000);

    activeSessions.set(threadID, {
      msgID,
      correct,
      correctIndex,
      correctLabel,
      question,
      choices,
      choiceLines,
      category,
      difficulty,
      reward,
      bonus,
      userId,          // who started (anyone can answer)
      timeoutHandle,
      usersData,
    });
  },

  // ── Listen for answers ──────────────────────────────────────────────────────
  onChat: async function ({ event, api, usersData }) {
    const threadID = event.threadID;
    if (!activeSessions.has(threadID)) return;

    const session = activeSessions.get(threadID);
    const body = (event.body || "").trim().toUpperCase();

    // Accept A/B/C/D
    if (!["A", "B", "C", "D"].includes(body)) return;

    const answerIndex = ["A", "B", "C", "D"].indexOf(body);
    const answererID = event.senderID;

    // Clear timeout and session
    clearTimeout(session.timeoutHandle);
    activeSessions.delete(threadID);

    const isCorrect = answerIndex === session.correctIndex;

    // Get answerer info
    let answererData = await usersData.get(answererID);
    if (!answererData) answererData = { money: 0, name: "Unknown" };

    let resultText = "";

    if (isCorrect) {
      answererData.money = (answererData.money || 0) + session.reward;
      await usersData.set(answererID, { ...answererData, money: answererData.money });

      resultText =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 𝐐𝐔𝐈𝐙 𝐑𝐄𝐒𝐔𝐋𝐓\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${session.category.emoji} ${session.category.label} | ${session.difficulty.emoji} ${session.difficulty.label}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❓ ${session.question}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${session.choiceLines}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ 𝐂𝐎𝐑𝐑𝐄𝐂𝐓! ${session.correctLabel}) ${session.correct}\n` +
        `🎉 @${answererData.name || answererID} won ${formatBalance(session.reward)}!\n` +
        `💰 𝐁𝐀𝐋𝐀𝐍𝐂𝐄: ${formatBalance(answererData.money)}`;
    } else {
      resultText =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧠 𝐐𝐔𝐈𝐙 𝐑𝐄𝐒𝐔𝐋𝐓\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${session.category.emoji} ${session.category.label} | ${session.difficulty.emoji} ${session.difficulty.label}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❓ ${session.question}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${session.choiceLines}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `❌ 𝐖𝐑𝐎𝐍𝐆! You answered: ${["𝐀","𝐁","𝐂","𝐃"][answerIndex]}) ${session.choices[answerIndex]}\n` +
        `✅ Correct answer: ${session.correctLabel}) ${session.correct}\n` +
        `💸 No reward this time.`;
    }

    await api.editMessage(resultText, session.msgID);
  }
};

const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });

const { GoatWrapper } = require("fca-saim-x69x");

module.exports = {
  config: {
    name: "slot",
    version: "1.1",
    author: "Charles MK",
    countDown: 5,
    role: 0,
    category: "game",
    description: "🎰 A fun slot game! Place your bet, spin the reels, and see how much you can win. Excitement guaranteed every spin!",
    usage: "slot <amount>\nExample: /slot 1000"
  },

  onStart: async function ({ event, api, usersData, args, message }) {
    const userId = event.senderID;
    const bet = parseInt(args[0]);

    let user = await usersData.get(userId);
    if (!user) {
      user = { money: 0 };
      await usersData.set(userId, user);
    }

    const prefix = event.body ? event.body[0] : "/";

    if (!bet || bet <= 0) {
      return message.reply(
        `❌ 𝐄𝐍𝐓𝐄𝐑 𝐀 𝐕𝐀𝐋𝐈𝐃 𝐁𝐄𝐓.\n𝐄𝐗𝐀𝐌𝐏𝐋𝐄: ${prefix}slot 1000`
      );
    }

    if (user.money < bet) {
      return message.reply(
        `❌ 𝐍𝐎𝐓 𝐄𝐍𝐎𝐔𝐆𝐇 𝐁𝐀𝐋𝐀𝐍𝐂𝐄.\n𝐁𝐀𝐋𝐀𝐍𝐂𝐄: ${user.money.toLocaleString()}$`
      );
    }

    // Deduct bet
    user.money -= bet;

    const symbols = ["🍒", "🍋", "🔔", "⭐", "💎"];

    // Determine outcome
    let s1, s2, s3;
    const chance = Math.random();

    if (chance < 0.30) {
      // Two matching symbols
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      let other;
      do { other = symbols[Math.floor(Math.random() * symbols.length)]; } while (other === sym);
      const pos = Math.floor(Math.random() * 3);
      if (pos === 0) { s1 = sym; s2 = sym; s3 = other; }
      else if (pos === 1) { s1 = sym; s2 = other; s3 = sym; }
      else { s1 = other; s2 = sym; s3 = sym; }
    } else if (chance < 0.45) {
      // Triple match
      const sym = symbols[Math.floor(Math.random() * symbols.length)];
      s1 = s2 = s3 = sym;
    } else {
      // All different
      const shuffled = [...symbols].sort(() => 0.5 - Math.random());
      s1 = shuffled[0]; s2 = shuffled[1]; s3 = shuffled[2];
    }

    // Calculate result
    let winnings = 0;
    let status = "";

    if (s1 === s2 && s2 === s3) {
      winnings = bet * 3;
      user.money += winnings;
      status = `✅ 𝐓𝐑𝐈𝐏𝐋𝐄 𝐌𝐀𝐓𝐂𝐇!\n│  𝐘𝐎𝐔 𝐖𝐎𝐍 ${winnings.toLocaleString()}$ 🎉`;
    } else if (s1 === s2 || s1 === s3 || s2 === s3) {
      winnings = bet * 2;
      user.money += winnings;
      status = `✅ 𝐃𝐎𝐔𝐁𝐋𝐄 𝐌𝐀𝐓𝐂𝐇!\n│  𝐘𝐎𝐔 𝐖𝐎𝐍 ${winnings.toLocaleString()}$ 🎉`;
    } else {
      status = `😢 𝐍𝐎 𝐌𝐀𝐓𝐂𝐇.\n│  𝐘𝐎𝐔 𝐋𝐎𝐒𝐓 ${bet.toLocaleString()}$`;
    }

    await usersData.set(userId, user);

    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Send initial message via message.reply — this gives a messageID compatible with api.editMessage
    const initMsg = await message.reply(`🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n\n🌀 Spinning the reels .`);
    const msgID = initMsg.messageID;

    // Animation frames
    const animFrames = [
      `🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n\n🌀 Spinning the reels ..`,
      `🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n\n🌀 Spinning the reels ...`,
      `🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n\n❓ Where will they land .`,
      `🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n\n❓ Where will they land ..`,
    ];

    for (const frame of animFrames) {
      await sleep(800);
      try {
        await api.editMessage(frame, msgID);
      } catch (_) {
        await sleep(600);
        try { await api.editMessage(frame, msgID); } catch (_) {}
      }
    }

    await sleep(800);

    // Final result — edit the same message one last time
    return api.editMessage(
      `━━━━━━━━━━━━━━\n` +
      `🎰 𝐒𝐋𝐎𝐓 𝐌𝐀𝐂𝐇𝐈𝐍𝐄\n` +
      `╭─╼━━━━━━━━━━╾─╮\n` +
      `│     ${s1} | ${s2} | ${s3}\n` +
      `│\n` +
      `│  ${status}\n` +
      `╰─╼━━━━━━━━━━╾─╯\n` +
      `💰 𝐁𝐀𝐋𝐀𝐍𝐂𝐄: ${user.money.toLocaleString()}$\n` +
      `━━━━━━━━━━━━━━`,
      msgID
    );
  }
};

const wrapper = new GoatWrapper(module.exports);
wrapper.applyNoPrefix({ allowPrefix: true });

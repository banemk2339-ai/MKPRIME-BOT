const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const jimp = require("jimp");

module.exports = {
  config: {
    name: "toilet",
    version: "1.0.0",
    role: 0,
    author: "Aphelion",
    description: "Tag someone and put their pic on toilet meme",
    category: "user",
    countDown: 5,
    guide: { en: "@tag someone" },
  },

  onLoad: async function () {
    const dir = path.join(__dirname, "cache");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const toiletPath = path.join(dir, "toilet.png");
    if (!fs.existsSync(toiletPath)) {
      await axios({
        method: "GET",
        url: "https://drive.google.com/uc?id=13ZqFryD-YY-JTs34lcy6b_w36UCCk0EI&export=download",
        responseType: "arraybuffer",
      }).then((res) => fs.writeFileSync(toiletPath, Buffer.from(res.data, "utf-8")));
    }
  },

  onStart: async function ({ api, event }) {
    const mentions = Object.keys(event.mentions);
    if (!mentions.length) return api.sendMessage("❌ Please tag 1 person!", event.threadID, event.messageID);

    const targetID = mentions[0];
    const dir = path.join(__dirname, "cache");
    const toiletPath = path.join(dir, "toilet.png");
    const avatarPath = path.join(dir, `avatar_${targetID}.png`);
    const outputPath = path.join(dir, `toilet_${targetID}.png`);

    try {
      // Get profile picture
      const res = await axios.get(
        `https://graph.facebook.com/${targetID}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`,
        { responseType: "arraybuffer" }
      );
      fs.writeFileSync(avatarPath, Buffer.from(res.data, "utf-8"));

      // Composite image
      const toiletImg = await jimp.read(toiletPath);
      const avatarImg = await jimp.read(avatarPath);
      avatarImg.circle().resize(70, 70);
      toiletImg.composite(avatarImg, 100, 200);
      await toiletImg.writeAsync(outputPath);

      api.sendMessage(
        { body: "🚽 Toilet Meme Generated!", attachment: fs.createReadStream(outputPath) },
        event.threadID,
        () => {
          fs.unlinkSync(avatarPath);
          fs.unlinkSync(outputPath);
        },
        event.messageID
      );
    } catch (err) {
      console.error(err);
      api.sendMessage("❌ Failed to generate toilet meme.", event.threadID, event.messageID);
    }
  },
};

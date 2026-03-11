
const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  config: {
    name: "drake",
    aliases: [],
    version: "1.1",
    author: "Muzan",
    countDown: 5,
    role: 0,
    shortDescription: "Generate Drake meme with + style",
    longDescription: "Create Drake meme using: *drake text1 + text2",
    category: "fun",
    guide: {
      en: "{pn} text1 + text2\nExample: {pn} Coke + Pepsi"
    }
  },

  onStart: async function ({ message, args }) {
    const input = args.join(" ");

    const parts = input.split("+");
    if (!parts || parts.length < 2) {
      return message.reply("⚠️ Format: *drake text1 + text2*\nExample: *drake Coke + Pepsi*");
    }

    const text1 = parts[0].trim();
    const text2 = parts[1].trim();

    if (!text1 || !text2) return message.reply("❌ Both texts are required!");

    const memeUrl = `https://api.memegen.link/images/drake/${encodeURIComponent(text1)}/${encodeURIComponent(text2)}.png`;
    const filePath = path.join(__dirname, `drake_${Date.now()}.png`);

    try {
      const res = await axios.get(memeUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(filePath, res.data);

      await message.reply({
        body: `🎵 Drake meme is ready!`,
        attachment: fs.createReadStream(filePath)
      });

      fs.unlinkSync(filePath);
    } catch (e) {
      console.error(e);
      message.reply("❌ Meme creation failed! Try again later.");
    }
  }
};

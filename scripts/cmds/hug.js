const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { loadImage, createCanvas } = require("canvas");

module.exports = {
  config: {
    name: "hug",
    aliases: ["hug"],
    version: "1.1",
    author: "Amit Max ⚡",
    countDown: 5,
    role: 0,
    shortDescription: "Give someone a hug!",
    longDescription: "A fun command to give someone a hug with a picture.",
    category: "fun",
    guide: "{pn} @mention or reply",
  },

  onStart: async function ({ event, api, usersData }) {
    let mention = Object.keys(event.mentions)[0];
    let targetID = mention || event.messageReply?.senderID;

    if (!targetID)
      return api.sendMessage("Who would you like to hug? Please tag someone or reply to a message!", event.threadID, event.messageID);

    const huggerID = event.senderID;

    const getAvatar = async (uid) => {
      try {
        const url = `https://graph.facebook.com/${uid}/picture?width=512&height=512&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
        const avatarPath = path.join(__dirname, `${uid}_avatar.png`);
        const res = await axios.get(url, { responseType: "arraybuffer" });
        fs.writeFileSync(avatarPath, res.data);
        return avatarPath;
      } catch (err) {
        console.error(`Error fetching avatar for user ${uid}: ${err.message}`);
        return "";
      }
    };

    const bg = await loadImage("https://i.imgur.com/eUNHCj3.jpeg");
    const canvas = createCanvas(bg.width, bg.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bg, 0, 0);

    const huggerAvatarPath = await getAvatar(huggerID);
    const targetAvatarPath = await getAvatar(targetID);

    const huggerAvatar = await loadImage(huggerAvatarPath);
    const targetAvatar = await loadImage(targetAvatarPath);

    
    ctx.save();
    ctx.beginPath();
    ctx.arc(285, 110, 50, 0, Math.PI * 2);  
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(huggerAvatar, 235, 60, 100, 100);  
    ctx.restore();

    
    ctx.save();
    ctx.beginPath();
    ctx.arc(460, 160, 50, 0, Math.PI * 2);  
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(targetAvatar, 410, 110, 100, 100);  

    const output = path.join(__dirname, "hug_output.png");
    fs.writeFileSync(output, canvas.toBuffer("image/png"));

    const senderName = await usersData.getName(huggerID);
    const targetName = event.mentions[mention] || (event.messageReply?.senderName || "Friend");

    api.sendMessage({
      body: `😍 I've just hugged ${targetName}! \n${senderName} is giving a warm hug to ${targetName}!`,
      attachment: fs.createReadStream(output),
      mentions: [{ tag: targetName, id: targetID }],
}, event.threadID, () => {
      fs.unlinkSync(output);
      fs.unlinkSync(huggerAvatarPath);
      fs.unlinkSync(targetAvatarPath);
    }, event.messageID);
  }
};

const DIG = require("discord-image-generation");
const fs = require("fs-extra");

module.exports = {
  config: {
    name: "trigger",
    version: "1.2",
    author: "NTKhang ",
    countDown: 5,
    role: 0,
    shortDescription: "Trigger image",
    longDescription: "Trigger image (tag, reply, or yourself)",
    category: "fun",
    guide: {
      vi: "{pn} [@tag | reply | để trống]",
      en: "{pn} [@tag | reply | empty]"
    }
  },

  onStart: async function ({ event, message, usersData }) {
    let uid;

    // যদি কারও mention করে
    if (Object.keys(event.mentions).length > 0) {
      uid = Object.keys(event.mentions)[0];
    }
    // যদি কারও মেসেজে reply করে
    else if (event.type === "message_reply") {
      uid = event.messageReply.senderID;
    }
    // নাহলে sender নিজেই
    else {
      uid = event.senderID;
    }

    const avatarURL = await usersData.getAvatarUrl(uid);
    const img = await new DIG.Triggered().getImage(avatarURL);
    const pathSave = `${__dirname}/tmp/${uid}_Trigger.gif`;

    fs.writeFileSync(pathSave, Buffer.from(img));

    message.reply({
      attachment: fs.createReadStream(pathSave)
    }, () => fs.unlinkSync(pathSave));
  }
};

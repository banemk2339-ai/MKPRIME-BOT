module.exports = {
  config: {
    name: "tag",
    aliases: ["mention"],
    version: "1.0",
    author: "Aphelion",
    countDown: 3,
    role: 0,
    shortDescription: "Mention the replied user",
    longDescription: "Tag the user from a replied message and add optional text.",
    category: "group",
    guide: {
      en: "{pn} [optional text] (reply to a message)",
    },
  },

  onStart: async function({ api, event, args }) {
    const { messageReply, threadID } = event;

    if (!messageReply) 
      return api.sendMessage("⚠️ Reply to a message to tag that user!", threadID);

    try {
      const targetID = messageReply.senderID;
      const userInfo = await api.getUserInfo(targetID);
      const name = userInfo[targetID]?.name || "Unknown User";
      const extraText = args.join(" ") || "";

      await api.sendMessage({
        body: `@${name} ${extraText}`,
        mentions: [{ id: targetID, tag: name }],
      }, threadID);

    } catch (error) {
      console.error(error);
      api.sendMessage("❌ Failed to tag user!", threadID);
    }
  },
};

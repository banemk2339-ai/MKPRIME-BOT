module.exports = {
  config: {
    name: "gcadmin",
    aliases: ['groupadmin', 'admingc', 'admingroup'],
    version: "1.5",
    author: "Asif",
    countDown: 5,
    role: 1,
    shortDescription: "Manage group admins",
    category: "box chat",
    guide: {
      en: "{p}{n} add [uid/mention/reply/self] | {p}{n} remove [uid/mention/reply/self]\n{p}{n} -a [uid/mention/reply/self] | {p}{n} -r [uid/mention/reply/self]",
    }
  },

  onStart: async function ({ api, event, args }) {
    const cmd = args[0];
    const target = args.slice(1).join(" ");
    const tID = event.threadID;

    // Normal command system
    if (cmd === "add" || cmd === "-a") return addAdmin(api, event, tID, target);
    if (cmd === "remove" || cmd === "-r") return removeAdmin(api, event, tID, target);

    api.sendMessage("❌ Invalid command!\nUsage: " + this.config.guide.en, tID);
  }
};

async function addAdmin(api, event, tID, target) {
  try {
    const uID = await getUID(api, event, target);
    const userInfo = await api.getUserInfo(uID);
    const name = userInfo[uID]?.name || uID;

    await api.changeAdminStatus(tID, uID, true);
    api.sendMessage(`✅ User ${name} promoted to admin.`, tID);
  } catch {
    api.sendMessage("- এডমিন দে আগে মগা..!😾", tID);
  }
}

async function removeAdmin(api, event, tID, target) {
  try {
    const uID = await getUID(api, event, target);
    const userInfo = await api.getUserInfo(uID);
    const name = userInfo[uID]?.name || uID;

    await api.changeAdminStatus(tID, uID, false);
    api.sendMessage(`✅ User ${name} removed from admin.`, tID);
  } catch {
    api.sendMessage("❌ Failed to remove admin.", tID);
  }
}

async function getUID(api, event, target) {
  if (event.type === "message_reply") return event.messageReply.senderID;
  if (event.mentions && Object.keys(event.mentions).length > 0) return Object.keys(event.mentions)[0];
  if (target) return target;
  return event.senderID;
}

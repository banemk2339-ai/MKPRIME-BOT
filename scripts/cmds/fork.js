module.exports = {
  config: {
    name: "fork",
    aliases: ["repo", "link"],
    version: "1.0",
    author: "Aphelion+C.MK",
    countDown: 3,
    role: 2,
    longDescription: "Returns the link to the official, updated fork of the bot's repository.",
    category: "system",
    guide: { en: "{pn}" }
  },

  onStart: async function({ message }) {
    const text = "https://github.com/ShifuX69/Prime-GoatBot.git";
    
    message.reply(text);
  }
};

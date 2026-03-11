const moment = require('moment-timezone');

module.exports = {
  config: {
    name: "time",
    version: "1.8",
    author: "Charles MK",
    countDown: 2,
    role: 0,
    category: "utility",
    guide: "{pn}"
  },

  onStart: async function ({ message }) {
    try {
      const saTime = moment().tz("Africa/Johannesburg");

      const formatted = 
        `🇿🇦 South African Time (SAST)\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📅 Date: ${saTime.format("dddd, MMMM Do YYYY")}\n` +
        `🕐 Time: ${saTime.format("hh:mm:ss A")}\n` +
        `🌍 Timezone: Africa/Johannesburg (UTC+2)`;

      return message.reply(formatted);
    } catch (error) {
      return message.reply("⚠️ An error occurred. Please try again later.");
    }
  }
};

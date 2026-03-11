const axios = require("axios");
const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");

const apiUrll = "https://www.noobs-apis.run.place";
const TEMP_FILES = new Set();

async function saveImage(url, name) {
  const outPath = path.join(__dirname, name);
  const res = await axios.get(url, { responseType: "stream" });
  const writer = fs.createWriteStream(outPath);
  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  TEMP_FILES.add(outPath);
  setTimeout(() => { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); TEMP_FILES.delete(outPath); }, 1000 * 60 * 60);
  return outPath;
}

async function cropImage(pathImg, index, id) {
  if (!fs.existsSync(pathImg)) throw new Error("Source image not found");
  const img = await Jimp.read(pathImg);
  const w = img.bitmap.width / 2;
  const h = img.bitmap.height / 2;
  const pos = { "1": [0, 0], "2": [w, 0], "3": [0, h], "4": [w, h] };
  const [sx, sy] = pos[index];
  const crop = img.clone().crop(sx, sy, w, h);
  const out = path.join(__dirname, `ok_crop_${id}_${index}_${Date.now()}.png`);
  await crop.writeAsync(out);
  TEMP_FILES.add(out);
  setTimeout(() => { if (fs.existsSync(out)) fs.unlinkSync(out); TEMP_FILES.delete(out); }, 1000 * 60 * 60);
  return out;
}

module.exports = {
  config: {
    name: "midjourney",
    version: "1.6.9",
    aliases: ["mj"],
    author: "Nazrul",
    countDown: 20,
    role: 0,
    isPremium: true,
    requiredMoney: 1000,
    description: "Generate AI images with Midjourney",
    category: "ai",
    guide: { en: "{pn} [prompt]" }
  },

  onStart: async function({ event, args, message }) {
    if (!args[0]) return message.reply(`• Please provide a prompt.\nExample: ${global.GoatBot.config.prefix}mj A Cat --ar 16:9`);
    const basePrompt = args.join(" ").trim();
    const apiUrl = `${apiUrll}/nazrul/midjourneyv?prompt=${encodeURIComponent(basePrompt)}`;
   const loadingMsg = await message.send("⏳ Mj Process started.. please wait!");
    message.reaction("⏳", event.messageID);

    try {
      const res = await axios.get(apiUrl);
      const data = res.data;
      if (!data.imageUrl) throw new Error("No image returned");

      const gridPath = await saveImage(data.imageUrl, `ok_grid_${data.id}_${Date.now()}.png`);
      const actionList = data.buttons?.map(a => a.label || "REROLL").join(", ") || "";
      const body = `✅ Midjourney process completed!\n• taskID: ${data.id}\n• Reply with 1-4 to get image\n• Reply with an action (e.g., U1, V2, REROLL)\n\n• Available actions: ${actionList}`;

      message.reply({ body, attachment: fs.createReadStream(gridPath) }, (err, info) => {
        if (!err) {
          if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name,
            author: event.senderID,
            taskId: data.id,
            actions: data.buttons || [],
            prompt: basePrompt
          });
        }
      });
      await message.unsend(loadingMsg.messageID);
      await message.reaction("✅", event.messageID);
    } catch (e) {
      message.unsend(loadingMsg.messageID);
      message.reaction("❌",event.messageID);
      console.log(e);
    }
  },

  onReply: async function({ event, Reply, message }) {
    if (!Reply) return;
    const { author, taskId, actions, prompt } = Reply;
    if (event.senderID !== author) return;

    const input = event.body.trim().toUpperCase();
    const validCropChoices = ["1", "2", "3", "4"];

    try {
      if (validCropChoices.includes(input)) {
        if (!event.messageReply || !event.messageReply.attachments || !event.messageReply.attachments[0]) {
          return message.reply("❌ No image found in the replied message.");
        }
        const imageUrl = event.messageReply.attachments[0].url;
        const tempPath = await saveImage(imageUrl, `ok_reply_${taskId}_${Date.now()}.png`);
        const cropPath = await cropImage(tempPath, input, taskId);
        return message.reply({ body: `✅ Here's selected image number: ${input}!`, attachment: fs.createReadStream(cropPath) });
      }

      if (input === "REROLL" || /^U[1-4]$/.test(input) || /^V[1-4]$/.test(input) || input.startsWith("UPSCALE") || input.startsWith("VARY") || input.startsWith("ZOOM")) {
        const matchedAction = actions.find(a => a.label.toUpperCase().includes(input)) || {};
        const cID = encodeURIComponent(matchedAction.customId || "");
        const actionURL = `${apiUrll}/nazrul/action?taskID=${taskId}${cID ? `&cID=${cID}` : ""}`;
        message.reaction("⏳", event.messageID);

        const res = await axios.get(actionURL);
        const data = res.data;
        if (!data.imageUrl) throw new Error("No image returned for action");

        const newGridPath = await saveImage(data.imageUrl, `ok_action_${data.id}_${input}_${Date.now()}.png`);
        const newActionList = data.buttons?.map(a => a.label || "REROLL").join(", ") || "";
        const body = `✅ Action completed!\n• taskID: ${data.id}\n• Action: ${data.action || input}\n• Reply with 1-4 to get image\n• Reply with another action (e.g., Upscale, Vary, Zoom)\n\n• Available actions: ${newActionList}`;

        message.reply({ body, attachment: fs.createReadStream(newGridPath) }, (err, info) => {
          if (!err) {
            if (!global.GoatBot.onReply) global.GoatBot.onReply = new Map();
            global.GoatBot.onReply.set(info.messageID, {
              commandName: this.config.name,
              author: event.senderID,
              taskId: data.id,
              actions: data.buttons || [],
              prompt
            });
          }
        });

        await message.reaction("✅", event.messageID);
        return;
      }

      message.reply("• Invalid input. Reply with 1-4 or an action like Upscale, Vary, Zoom, or Reroll.");
    } catch (e) {
      message.reaction("❌", event.messageID);
      console.log(e);
    }
  }
};
        

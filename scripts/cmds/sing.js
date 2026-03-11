const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const apiUrl = "https://www.noobs-apis.run.place";

module.exports.config = {
  name: "sing",
  aliases: ["music"],
  version: "1.6.9",
  author: "Nazrul",
  role: 0,
  description: "Search & download MP3, Shazam recognize, YouTube info",
  category: "media",
  countDown: 7,
  guide: {
    en: "{pn} query - Reply With Number!\n{pn} reply to Media!"
  }
};

module.exports.onStart = async function ({ message, event, args }) {
  if (event.messageReply) {
    const replyMsg = event.messageReply;
    if (replyMsg.attachments && replyMsg.attachments[0]) {
      const att = replyMsg.attachments[0];
      const url = att.url;
      if (/audio|video|.mp3|.mp4|.m4a|.mov/.test(att.type || url)) return shazam(message, event, url);
      if (/(youtu\.be|youtube\.com)/.test(url)) {
        if (args[0] === "-info") return vInfo(message, event, url);
        return downloadMP3(message, event, url, "YouTube Audio", "", "", "");
      }
    }
    if (replyMsg.body) {
      const ytMatch = replyMsg.body.match(/(https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/\S+)/);
      if (ytMatch) {
        const ytUrl = ytMatch[0];
        if (args[0] === "-info") return vInfo(message, event, ytUrl);
        return downloadMP3(message, event, ytUrl, "✅ Downloaded", "", "", "");
      }
    }
  }
  if (!args[0]) return message.reply("Required Song name!");
  if (args[0] === "-info") {
    const url = args[1];
    if (!url || !/(youtu\.be|youtube\.com)/.test(url)) return message.reply("Provide a valid YouTube URL after -info!");
    return vInfo(message, event, url);
  }
  if (/(youtu\.be|youtube\.com)/.test(args[0])) {
    const url = args[0];
    return downloadMP3(message, event, url, "YouTube Audio", "", "", "");
  }
  const query = args.join(" ");
  return searchSong(message, event, query);
};

async function shazam(message, event, fileUrl) {
  await message.reaction("⏳", event.messageID);
  try {
    const ok = await axios.get(`${apiUrl}/nazrul/shazamSong-Recognize?url=${encodeURIComponent(fileUrl)}`);
    const data = ok.data;

    const songTitle = data.title;
    const artist = data.subtitle || "";
    
    const searchQuery = `${songTitle} ${artist}`.trim();
    return searchAndDownloadAfterShazam(message, event, searchQuery, data);
    
  } catch (e) {
    message.reply("× Failed to recognize the song.");
    message.reaction("❌", event.messageID);
    console.log(e);
  }
}

async function searchAndDownloadAfterShazam(message, event, query, shazamData) {
  try {
    const res = await axios.get(`${apiUrl}/nazrul/youtube?type=s&query=${encodeURIComponent(query)}`);
    const data = res.data?.results?.data || [];
    
    if (!data.length) {
      return downloadFromAppleMusic(message, event, shazamData);
    }
    
    const video = data[0];
    
    const downloadRes = await axios.get(`${apiUrl}/nazrul/youtube?type=mp3&url=${encodeURIComponent(`https://youtu.be/${video.id}`)}`);
    const downloadUrl = downloadRes.data.download_url;
    
    if (!downloadUrl) {
      return downloadFromAppleMusic(message, event, shazamData);
    }
    
    const file = await axios.get(downloadUrl, { responseType: "arraybuffer" });
    const fileName = `${video.title.replace(/[^\w]/g, "_")}.mp3`;
    const filePath = path.join(__dirname, fileName);
    
    fs.writeFileSync(filePath, file.data);
    
    await message.reaction("✅", event.messageID);
    
    await message.reply({
      body: `✅ Title: ${shazamData.title}\n• Artist: ${shazamData.subtitle || "Unknown"}\n• Album: ${shazamData.album || "Unknown"}\n• Genre: ${shazamData.genre || "Unknown"}\n`,
      attachment: fs.createReadStream(filePath)
    });
    
    fs.unlinkSync(filePath);
    
  } catch (e) {
    return downloadFromAppleMusic(message, event, shazamData);
  }
}

async function downloadFromAppleMusic(message, event, shazamData) {
  try {
    const songURL = shazamData.apple_music_url;
    if (!songURL) throw new Error("No download URL");
    
    const tmp = path.join(__dirname, "shazam_" + Date.now() + ".mp3");
    const w = fs.createWriteStream(tmp);
    
    (await axios.get(songURL, { responseType: "stream" })).data.pipe(w);
    
    w.on("finish", async () => {
      await message.reaction("✅", event.messageID);
      await message.reply({
        body: `✅ Title: ${shazamData.title}\n• Subtitle: ${shazamData.subtitle}\n• Album: ${shazamData.album}\n#• Genre: ${shazamData.genre}\n`,
        attachment: fs.createReadStream(tmp)
      });
      fs.unlinkSync(tmp);
    });
    
    w.on("error", () => {
      message.reply("✅ Song recognized but couldn't download the song.\nTitle: " + shazamData.title + "\nArtist: " + shazamData.subtitle);
      message.reaction("❌", event.messageID);
    });
    
  } catch (e) {
    message.reply("✅ Song recognized: " + shazamData.title + "\nArtist: " + (shazamData.subtitle || "Unknown") + "\nBut failed to download the song.");
    message.reaction("❌", event.messageID);
  }
}

async function vInfo(message, event, url) {
  await message.reaction("⏳", event.messageID);

  try {
    const res = await axios.get(`${apiUrl}/nazrul/youtube?type=info&url=${encodeURIComponent(url)}`);
    const data = res.data?.video;

    if (!data) return message.send("❌ Failed to fetch info!");

    const v = data.video || data;
    const c = data.channel;

    const duration = v.duration?.replace("PT", "").replace("H", ":").replace("M", ":").replace("S", "") || "N/A";
    const info =
`✅ ${v.title}\n• Channel: ${c.title || "Unknown"}\n• Views: ${v.viewCount || "N/A"}\n• Likes: ${v.likeCount || "N/A"}\n• Duration: ${duration}\n• Uploaded by: ${c.title}`;

    const thumbUrl = v.thumbnails?.maxres?.url || v.thumbnails?.high?.url;
    const thumbPath = path.join(__dirname, "info_thumb.jpg");
    const writer = fs.createWriteStream(thumbPath);

    const img = (await axios.get(thumbUrl, { responseType: "stream" })).data;
    img.pipe(writer);

    await new Promise(r => writer.on("finish", r));

    await message.reaction("✅", event.messageID);
    await message.reply({ body: info, attachment: fs.createReadStream(thumbPath) });

    fs.unlinkSync(thumbPath);
  } catch (e) {
    message.reaction("❌", event.messageID);
    console.log(e);
  }
}

async function searchSong(message, event, query) {
  await message.reaction("⏳", event.messageID);

  try {
    const res = await axios.get(`${apiUrl}/nazrul/youtube?type=s&query=${encodeURIComponent(query)}`);
    const data = res.data?.results?.data || [];
    if (!data.length) return message.reply("× No results Returned.");

    let txt = "✅ Here's Search Results:\n\n";
    const thumbs = [];

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const v = data[i];
      txt += `${i + 1}. ${v.title}\n• Duration: ${v.duration || "Not found!"}\n• PublishedAt: ${v.publishedAt || "Not found"}\n\n`;

      const imgUrl = v.thumbHigh || v.thumbMedium || v.thumbDefault;
      const imgPath = path.join(__dirname, `yt_${i + 1}.jpg`);
      const img = await axios.get(imgUrl, { responseType: "arraybuffer" });

      fs.writeFileSync(imgPath, img.data);
      thumbs.push(fs.createReadStream(imgPath));
    }

    txt += "• Reply with a number to Get Song.";

    message.reaction("✅", event.messageID);

    message.reply({ body: txt, attachment: thumbs }, (err, info) => {
      if (err) return;

      global.GoatBot.onReply.set(info.messageID, {
        commandName: module.exports.config.name,
        type: "search",
        messageID: info.messageID,
        author: event.senderID,
        results: data
      });
    });

  } catch (e) {
    message.reaction("❌", event.messageID);
    console.log(e);
  }
}

module.exports.onReply = async function ({ event, message, Reply }) {
  const { type, results, messageID, author } = Reply;

  if (event.senderID != author) return;

  if (type === "search") {
    const num = parseInt(event.body.trim());
    if (isNaN(num) || num < 1 || num > results.length)
      return message.reply("• Reply with a valid number.");

    const video = results[num - 1];
    message.unsend(messageID);

    return downloadMP3(message, event, `https://youtu.be/${video.id}`, video.title, video.duration, video.publishedAt, video.viewCount);
  }
};

async function downloadMP3(message, event, url, title, duration, publishedAt, viewCount) {
  await message.reaction("⏳", event.messageID);

  try {
    const res = await axios.get(`${apiUrl}/nazrul/youtube?type=mp3&url=${encodeURIComponent(url)}`);
    const downloadUrl = res.data.download_url;
    if (!downloadUrl) return message.send("Download link not found!");

    const file = await axios.get(downloadUrl, { responseType: "arraybuffer" });

    const fileName = `${title.replace(/[^\w]/g,"_")}.mp3`;
    const filePath = path.join(__dirname, fileName);

    fs.writeFileSync(filePath, file.data);

    await message.reaction("✅", event.messageID);

    await message.reply({
      body: `✅ ${title || "Not Found!"}\n• Duration: ${duration || "Not Found!"}\n• Views: ${viewCount || "Not found!"}\n• PublishedAt: ${publishedAt || "Not found!"}`,
      attachment: fs.createReadStream(filePath)
    });

    fs.unlinkSync(filePath);
  } catch (e) {
    message.reaction("❌", event.messageID);
    console.log(e);
  }
}

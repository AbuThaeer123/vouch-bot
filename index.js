require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// 🔥 Config
const VOUCH_CHANNEL_ID = "1417508847148466337";
const LOG_CHANNEL_ID = "1422951506625167634"; // replace with your log channel
const ADMIN_IDS = ["877762665416626196", "955037670734700594", "1312176404925907066"]; // admin IDs
const SPECIAL_USER_ID = "955037670734700594"; // your ID for "Yes honey" reply
const ROAST_HELPER_ID = "1247942875006767226"; // helper to roast in list 

const PREFIX = ".";
const vouchFile = "vouches.json";

// Load vouches
let vouches = {};
if (fs.existsSync(vouchFile)) {
  try {
    vouches = JSON.parse(fs.readFileSync(vouchFile));
  } catch (err) {
    console.error("Failed to parse vouches.json, resetting to empty object.");
    vouches = {};
    saveVouches();
  }
}

function saveVouches() {
  fs.writeFileSync(vouchFile, JSON.stringify(vouches, null, 2));
}

client.once("ready", () => {
  console.log(`${client.user.tag} is online ✅`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // --- Auto log image vouches ---
  if (message.channel.id === VOUCH_CHANNEL_ID && message.attachments.size > 0) {
    const images = message.attachments.filter(att =>
      att.contentType?.startsWith("image/") || att.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    if (images.size > 0) {
      const userId = message.author.id;
      if (!Array.isArray(vouches[userId])) vouches[userId] = [];

      images.forEach(att => {
        vouches[userId].push({
          by: message.author.id,
          reason: "Image Vouch",
          date: new Date().toLocaleString(),
          url: att.url,
          name: att.name || att.filename || "attachment"
        });
      });

      saveVouches();

      try { await message.react("✅"); } catch (err) { console.error("Failed to react:", err); }

      // “Yes honey 💖” auto-reply
      if (message.author.id === SPECIAL_USER_ID) return message.reply("Yes honey 💖");
    }
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  // --- Force add image vouch (admin only) ---
  if (command === "forcevouch") {
    if (!ADMIN_IDS.includes(message.author.id)) return message.reply("🚫 You don’t have permission.");
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a valid user.");
    if (message.attachments.size === 0) return message.reply("❌ Attach at least one image.");

    if (!Array.isArray(vouches[user.id])) vouches[user.id] = [];
    const images = message.attachments.filter(att =>
      att.contentType?.startsWith("image/") || att.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    if (images.size === 0) return message.reply("❌ No valid images attached.");

    images.forEach(att => {
      vouches[user.id].push({
        by: message.author.id,
        reason: "Image Vouch (admin)",
        date: new Date().toLocaleString(),
        url: att.url,
        name: att.name || att.filename || "attachment",
        addedByAdmin: true
      });
    });

    saveVouches();
    try { await message.react("✅"); } catch (err) { console.error(err); }

    return message.reply(`✅ Added ${images.size} image vouch(es) for **${user.username}** on their behalf.`);
  }

  // --- Delete single vouch (admin only) ---
  if (command === "delvouch") {
    if (!ADMIN_IDS.includes(message.author.id)) return message.reply("🚫 You don’t have permission.");

    const user = message.mentions.users.first();
    const index = parseInt(args[1], 10) - 1;
    if (!user || isNaN(index)) return message.reply("❌ Usage: `.delvouch @user <vouchNumber>`");

    if (!Array.isArray(vouches[user.id]) || !vouches[user.id][index])
      return message.reply("❌ Invalid vouch index.");

    const removed = vouches[user.id].splice(index, 1)[0];
    saveVouches();

    // Log deletion in embed
    try {
      const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
      if (logChannel) {
        const embed = new EmbedBuilder()
          .setTitle(`🗑 Vouch deleted by <@${message.author.id}>`)
          .addFields(
            { name: "Vouched User", value: `<@${user.id}>`, inline: true },
            { name: "Reason", value: removed.reason || "No reason", inline: true },
            { name: "Date", value: removed.date, inline: true }
          )
          .setImage(removed.url)
          .setFooter({ text: removed.name || "attachment" })
          .setColor("Red")
          .setTimestamp();

        logChannel.send({ embeds: [embed] });
      }
    } catch (err) { console.error("Failed to log deleted vouch:", err); }

    return message.reply(`🗑 Deleted vouch #${index + 1} for ${user.username}.`);
  }

  // --- List vouches ---
  if (command === "listvouches") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user.");

    if (!Array.isArray(vouches[user.id])) vouches[user.id] = [];
    const userVouches = vouches[user.id];
    if (userVouches.length === 0) return message.reply(`❌ ${user.username} has no vouches.`);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Vouches for ${user.username}`)
      .setColor("Green")
      .setDescription(
        userVouches.map((v, i) => {
          const link = v.url ? `[View Image](${v.url})` : "";
          let line = `**${i + 1}.** <@${v.by}> → *${v.reason}* ${link}\n🕒 ${v.date}`;
          if (v.addedByAdmin) line += " (added by admin)";
          return line;
        }).join("\n\n")
      )
      .setTimestamp();

    // Roast helper
    if (user.id === ROAST_HELPER_ID)
      embed.setDescription(embed.data.description + "\n\n💔🥀 you're so chopped twin");

    return message.channel.send({ embeds: [embed] });
  }

  // --- Count vouches ---
  if (command === "vouches") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user.");

    if (!Array.isArray(vouches[user.id])) vouches[user.id] = [];
    const count = vouches[user.id].length;

    return message.reply(`✅ ${user.username} has **${count}** vouches.`);
  }
});

client.login(process.env.DISCORD_TOKEN.trim());
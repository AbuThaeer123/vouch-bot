require("dotenv").config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
});

// 🔥 Hardcode your vouch channel ID
const VOUCH_CHANNEL_ID = "1417508847148466337";

const PREFIX = ".";
const vouchFile = "vouches.json";

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
  // Debug log
  console.log(`[MESSAGE] ${message.author.tag}: ${message.content}`);

  if (message.author.bot) return;

  // --- Auto log image vouches ---
  if (message.channel.id === VOUCH_CHANNEL_ID && message.attachments.size > 0) {
    const images = message.attachments.filter(att =>
      att.contentType?.startsWith("image/") || att.url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    );
    if (images.size > 0) {
      const userId = message.author.id;
      // SAFETY: always an array
      if (!Array.isArray(vouches[userId])) vouches[userId] = [];

      images.forEach((att) => {
        vouches[userId].push({
          by: message.author.id,
          reason: "Image Vouch",
          date: new Date().toLocaleString(),
          url: att.url,
          name: att.name || att.filename || "attachment"
        });
      });

      saveVouches();
      try {
        await message.react("✅");
        console.log(`[IMAGE VOUCH] ${message.author.tag} posted ${images.size} image(s)`);
      } catch (err) {
        console.error("Failed to react:", err);
      }
    }
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // --- Add text vouch ---
  if (command === "vouch") {
    if (message.channel.id !== VOUCH_CHANNEL_ID) {
      return message.reply(`❌ Use this command only in <#${VOUCH_CHANNEL_ID}>.`);
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user to vouch for.");
    const reason = args.slice(1).join(" ") || "No reason provided";

    if (!Array.isArray(vouches[user.id])) vouches[user.id] = [];

    const vouchData = {
      by: message.author.id,
      reason,
      date: new Date().toLocaleString(),
    };

    vouches[user.id].push(vouchData);
    saveVouches();

    console.log(`[VOUCH ADDED] ${user.tag} by ${message.author.tag}: ${reason}`);
    return message.reply(`✅ Added a vouch for **${user.username}** with reason: *${reason}*`);
  }

  // --- List vouches ---
  if (command === "listvouches") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user.");

    const userVouches = Array.isArray(vouches[user.id]) ? vouches[user.id] : [];
    if (userVouches.length === 0) return message.reply(`❌ ${user.username} has no vouches.`);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Vouches for ${user.username}`)
      .setColor("Green")
      .setDescription(
        userVouches
          .map(
            (v, i) => {
              const link = v.url ? `[View Image](${v.url})` : "";
              return `**${i + 1}.** <@${v.by}> → *${v.reason}* ${link}\n🕒 ${v.date}`;
            }
          )
          .join("\n\n")
      )
      .setTimestamp();

    console.log(`[LIST VOUCHES] ${user.tag} requested by ${message.author.tag}`);
    return message.channel.send({ embeds: [embed] });
  }

  // --- Delete single vouch ---
  if (command === "delvouch") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You don’t have permission.");
    }

    const user = message.mentions.users.first();
    const index = parseInt(args[1]) - 1;

    if (!user || isNaN(index)) return message.reply("❌ Usage: `.delvouch @user <vouchNumber>`");
    if (!Array.isArray(vouches[user.id]) || !vouches[user.id][index]) {
      return message.reply("❌ Invalid vouch index.");
    }

    vouches[user.id].splice(index, 1);
    saveVouches();

    console.log(`[DEL VOUCH] Removed vouch #${index + 1} for ${user.tag} by ${message.author.tag}`);
    return message.reply(`✅ Removed vouch #${index + 1} for ${user.username}.`);
  }

  // --- Clear all vouches ---
  if (command === "clearvouch") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ You don’t have permission.");
    }

    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user.");

    vouches[user.id] = [];
    saveVouches();

    console.log(`[CLEAR VOUCH] Cleared all vouches for ${user.tag} by ${message.author.tag}`);
    return message.reply(`✅ Cleared all vouches for ${user.username}.`);
  }

  // --- Check vouch count ---
  if (command === "vouches") {
    const user = message.mentions.users.first();
    if (!user) return message.reply("❌ Mention a user.");

    const count = Array.isArray(vouches[user.id]) ? vouches[user.id].length : 0;
    console.log(`[VOUCH COUNT] ${user.tag} has ${count} vouches, requested by ${message.author.tag}`);
    return message.reply(`✅ ${user.username} has **${count}** vouches.`);
  }
});

client.login(process.env.DISCORD_TOKEN);

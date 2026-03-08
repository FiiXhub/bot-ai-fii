require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const Groq = require("groq-sdk");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

client.once("clientReady", () => {
  console.log(`Bot online sebagai ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

  if (message.author.bot) return;
  if (!message.content.startsWith("!ai")) return;

  const prompt = message.content.replace("!ai", "");

  try {

    const chat = await groq.chat.completions.create({
      messages: [
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile"
    });

    message.reply(chat.choices[0].message.content);

  } catch (error) {
    console.log(error);
    message.reply("AI sedang error, coba lagi.");
  }

});

client.login(process.env.DISCORD_TOKEN);
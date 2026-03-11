require("dotenv").config();

const {
Client,
GatewayIntentBits,
ActionRowBuilder,
ButtonBuilder,
ButtonStyle,
EmbedBuilder,
ChannelType,
PermissionsBitField
} = require("discord.js");

const Groq = require("groq-sdk");
const fs = require("fs");

const client = new Client({
intents:[
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
]
});

const groq = new Groq({
apiKey: process.env.GROQ_API_KEY
});

/* ================= DATABASE SEDERHANA ================= */

const memory = new Map()
const cooldown = new Map()
const userChannels = new Map()

const MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile"

/* ================= PANEL BUTTON ================= */

client.once("clientReady", async () => {

console.log(`Bot online sebagai ${client.user.tag}`);

const channelId = process.env.PANEL_CHANNEL
if(!channelId) return

const channel = await client.channels.fetch(channelId)

const embed = new EmbedBuilder()
.setTitle("AI Chat Bot")
.setDescription("Tekan tombol di bawah untuk membuat channel chat dengan AI\nCreate By Fii.")
.setColor("Blue")

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("buat_chat_ai")
.setLabel("🧠 Buat Chat AI")
.setStyle(ButtonStyle.Success)
)

channel.send({
embeds:[embed],
components:[row]
})

})

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async interaction => {

if(!interaction.isButton()) return

/* ===== BUAT CHANNEL ===== */

if(interaction.customId === "buat_chat_ai"){

if(userChannels.has(interaction.user.id)){

return interaction.reply({
content:`Kamu sudah punya channel AI: <#${userChannels.get(interaction.user.id)}>`,
ephemeral:true
})

}

const parent = interaction.channel.parent
const position = interaction.channel.rawPosition + 1

const newChannel = await interaction.guild.channels.create({
name:`ai-chat-${interaction.user.username}`,
type:ChannelType.GuildText,
parent: parent,
position: position,
permissionOverwrites:[
{
id:interaction.guild.id,
deny:[PermissionsBitField.Flags.ViewChannel]
},
{
id:interaction.user.id,
allow:[
PermissionsBitField.Flags.ViewChannel,
PermissionsBitField.Flags.SendMessages,
PermissionsBitField.Flags.ReadMessageHistory
]
}
]
})

userChannels.set(interaction.user.id,newChannel.id)

const embed = new EmbedBuilder()
.setTitle("Chat AI Dibuat")
.setDescription("Silakan kirim pesan langsung ke AI 🤖")
.setColor("Green")

const row = new ActionRowBuilder().addComponents(
new ButtonBuilder()
.setCustomId("akhiri_chat_ai")
.setLabel("🛑 Akhiri Chat")
.setStyle(ButtonStyle.Danger)
)

await newChannel.send({
content:`${interaction.user}`,
embeds:[embed],
components:[row]
})

interaction.reply({
content:`Channel AI berhasil dibuat: ${newChannel}`,
ephemeral:true
})

}

/* ===== AKHIRI CHAT + TRANSCRIPT ===== */

if(interaction.customId === "akhiri_chat_ai"){

await interaction.reply({
content:"Menyimpan log chat...",
ephemeral:true
})

try{

const messages = await interaction.channel.messages.fetch({ limit:100 })

const sorted = Array.from(messages.values()).sort((a,b)=>a.createdTimestamp-b.createdTimestamp)

let transcript = `AI CHAT TRANSCRIPT\n`
transcript += `Server : ${interaction.guild.name}\n`
transcript += `Channel : ${interaction.channel.name}\n`
transcript += `User : ${interaction.user.tag}\n`
transcript += `Tanggal : ${new Date().toLocaleString()}\n`
transcript += `\n---------------------------------------\n\n`

sorted.forEach(msg=>{

const name = msg.author.bot ? "AI" : msg.author.username
transcript += `[${name}] ${msg.content}\n\n`

})

const fileName = `ai-chat-${interaction.user.username}.txt`

fs.writeFileSync(fileName, transcript)

const logChannelId = process.env.LOG_CHANNEL

if(logChannelId){

const logChannel = interaction.guild.channels.cache.get(logChannelId)

if(logChannel){

await logChannel.send({
content:`📄 Transcript chat AI dari ${interaction.user.tag}`,
files:[fileName]
})

}

}

fs.unlinkSync(fileName)

}catch(err){

console.log(err)

}

userChannels.delete(interaction.user.id)
memory.delete(interaction.channel.id)

setTimeout(()=>{
interaction.channel.delete().catch(()=>{})
},2000)

}

})

/* ================= AI CHAT ================= */

client.on("messageCreate", async (message) => {

if(message.author.bot) return
if(!message.channel.name.startsWith("ai-chat")) return

/* ===== ANTI SPAM ===== */

if(cooldown.has(message.author.id)){

return message.reply("Tunggu sebentar sebelum bertanya lagi ⏳")

}

cooldown.set(message.author.id,true)
setTimeout(()=>{
cooldown.delete(message.author.id)
},3000)

/* ===== MEMORY CHAT ===== */

if(!memory.has(message.channel.id)){

memory.set(message.channel.id,[
{ role:"system", content:"Kamu adalah AI assistant yang ramah dan membantu." }
])

}

const chatMemory = memory.get(message.channel.id)

chatMemory.push({
role:"user",
content:message.content
})

try{

await message.channel.sendTyping()

const chat = await groq.chat.completions.create({
messages: chatMemory,
model: MODEL
})

const reply = chat.choices[0].message.content

chatMemory.push({
role:"assistant",
content:reply
})

if(chatMemory.length > 20){
chatMemory.splice(1,2)
}

message.reply(reply)

}catch(error){

console.log(error)
message.reply("AI sedang error, coba lagi.")

}

})

client.login(process.env.DISCORD_TOKEN);
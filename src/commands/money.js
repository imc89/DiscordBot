const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");

const moneyFile = path.join(__dirname, "money.json");

// Función para leer el archivo JSON
async function readMoneyFile() {
    try {
        const data = await fs.readFile(moneyFile, "utf8");
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// Función para escribir en el archivo JSON
async function writeMoneyFile(data) {
    await fs.writeFile(moneyFile, JSON.stringify(data, null, 2));
}

// Array con mensajes y recompensas para el comando de trabajo
const jobRewards = [
    { message: "Has encontrado **{amount}** monedas perdidas. ¡Qué suerte!", amount: 50 },
    { message: "Por un pequeño trabajo te han dado **{amount}** monedas.", amount: 125 },
    { message: "Ayudaste a un bot a resolver un problema técnico y te recompensó con **{amount}** monedas.", amount: 75 },
    { message: "Has limpiado los canales de spam y te han pagado **{amount}** monedas.", amount: 100 },
    { message: "Un usuario te pagó **{amount}** monedas por un buen consejo.", amount: 60 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_money")
        .setDescription("Gestiona el sistema de dinero del servidor.")
        .addSubcommand(subcommand =>
            subcommand
                .setName('balance')
                .setDescription('Muestra el balance de dinero de un usuario.')
                .addUserOption(option =>
                    option.setName("usuario")
                        .setDescription("El usuario del que quieres ver el balance.")
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('daily')
                .setDescription('Reclama tu recompensa diaria.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('job')
                .setDescription('Realiza un pequeño trabajo para ganar dinero.')
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        let moneyData = await readMoneyFile();

        // Si el usuario no existe en la base de datos, lo inicializamos
        if (!moneyData[userId]) {
            moneyData[userId] = { balance: 0, last_daily: null, last_job: null };
            await writeMoneyFile(moneyData);
        }

        if (subcommand === 'daily') {
            const lastDaily = moneyData[userId].last_daily;
            const now = new Date();
            const oneDayInMs = 24 * 60 * 60 * 1000;

            if (lastDaily && (now.getTime() - new Date(lastDaily).getTime()) < oneDayInMs) {
                const timeLeft = oneDayInMs - (now.getTime() - new Date(lastDaily).getTime());
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                return await interaction.reply({
                    content: `⏰ Ya has reclamado tu recompensa diaria. Vuelve a intentarlo en ${hoursLeft} hora(s) y ${minutesLeft} minuto(s).`,
                    ephemeral: true
                });
            }

            const dailyReward = 200;
            moneyData[userId].balance += dailyReward;
            moneyData[userId].last_daily = now.toISOString();
            await writeMoneyFile(moneyData);

            const embed = new EmbedBuilder()
                .setTitle("🎁 Recompensa Diaria")
                .setDescription(`Has reclamado tu recompensa de **${dailyReward}** monedas. Tu nuevo balance es de **${moneyData[userId].balance}** monedas.`)
                .setColor("Gold")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            
        } else if (subcommand === 'job') {
            const lastJob = moneyData[userId].last_job;
            const now = new Date();
            const jobCooldownInMs = 2 * 60 * 60 * 1000; // Cooldown de 2 horas

            if (lastJob && (now.getTime() - new Date(lastJob).getTime()) < jobCooldownInMs) {
                const timeLeft = jobCooldownInMs - (now.getTime() - new Date(lastJob).getTime());
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                
                return await interaction.reply({
                    content: `⏰ Ya has completado un trabajo recientemente. Vuelve a intentarlo en ${hoursLeft} hora(s) y ${minutesLeft} minuto(s).`,
                    ephemeral: true
                });
            }

            const randomReward = jobRewards[Math.floor(Math.random() * jobRewards.length)];
            const jobReward = randomReward.amount;
            moneyData[userId].balance += jobReward;
            moneyData[userId].last_job = now.toISOString();
            await writeMoneyFile(moneyData);

            const embed = new EmbedBuilder()
                .setTitle("💼 Trabajo Completado")
                .setDescription(randomReward.message.replace('{amount}', jobReward))
                .addFields({
                    name: 'Balance Actual',
                    value: `Tu nuevo balance es de **${moneyData[userId].balance}** monedas.`,
                })
                .setColor("Orange")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            
        } else if (subcommand === 'balance') {
            const user = interaction.options.getUser("usuario") || interaction.user;
            const targetId = user.id;

            let balance = 0;
            if (moneyData[targetId]) {
                balance = moneyData[targetId].balance;
            }

            const embed = new EmbedBuilder()
                .setTitle("💰 Balance de Monedas")
                .setDescription(`El balance de **${user.username}** es de **${balance}** monedas.`)
                .setColor("Green")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    },
};
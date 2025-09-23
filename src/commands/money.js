const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs").promises;
const path = require("path");

const moneyFile = path.join(__dirname, "money.json");

// Define los IDs de los usuarios que pueden usar el comando de gestión
const allowedUsers = ['852486349520371744', '1056942076480204801'];

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
// Ahora incluye múltiples opciones para perder dinero
const jobRewards = [
    { message: "Has encontrado **{amount}**$ perdidas. ¡Qué suerte!", amount: 50 },
    { message: "Por un pequeño trabajo te han dado **{amount}**$.", amount: 125 },
    { message: "Ayudaste a un bot a resolver un problema técnico y te recompensó con **{amount}**$.", amount: 75 },
    { message: "Has limpiado los canales de spam y te han pagado **{amount}**$.", amount: 100 },
    { message: "Un usuario te pagó **{amount}**$ por un buen consejo.", amount: 60 },
    
    // --- Opciones de pérdida ---
    { message: "Tu trabajo salió mal y has tenido que pagar una multa de **{amount}**$.", amount: -40 },
    { message: "Mientras trabajabas, causaste un accidente y perdiste **{amount}**$ para reparaciones.", amount: -75 },
    { message: "Te robaron algunas ganancias. Has perdido **{amount}**$.", amount: -100 },
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
                .setDescription('Realiza un pequeño trabajo para ganar o perder dinero.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfiere dinero a otro usuario.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario al que quieres transferir dinero.')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('La cantidad de monedas a transferir.')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommandGroup(group =>
            group
                .setName('manage')
                .setDescription('Comandos de gestión del dinero (solo para admins).')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('Ver el contenido del archivo money.json.')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('edit')
                        .setDescription('Editar el balance de un usuario.')
                        .addUserOption(option =>
                            option.setName("usuario")
                                .setDescription("El usuario cuyo balance quieres editar.")
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option.setName("cantidad")
                                .setDescription("La nueva cantidad de monedas.")
                                .setRequired(true)
                        )
                )
        ),

    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        let moneyData = await readMoneyFile();

        if (!moneyData[userId]) {
            moneyData[userId] = {
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                balance: 0,
                last_daily: null,
                last_job: null
            };
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
            const jobCooldownInMs = 2 * 60 * 60 * 1000;

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
                .setTitle("💼 Resultado del Trabajo")
                .setDescription(randomReward.message.replace('{amount}', Math.abs(jobReward)))
                .addFields({
                    name: 'Balance Actual',
                    value: `Tu nuevo balance es de **${moneyData[userId].balance}** monedas.`,
                })
                .setColor(jobReward >= 0 ? "Orange" : "Red")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            
        } else if (subcommand === 'balance') {
            const user = interaction.options.getUser("usuario") || interaction.user;
            const targetId = user.id;

            let balance = 0;
            let usernameToDisplay = user.displayName;

            if (moneyData[targetId]) {
                balance = moneyData[targetId].balance;
                if (moneyData[targetId].displayName) {
                    usernameToDisplay = moneyData[target-d].displayName;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle("💰 Balance de Monedas")
                .setDescription(`El balance de **${usernameToDisplay}** es de **${balance}** monedas.`)
                .setColor("Green")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'transfer') {
            const recipientUser = interaction.options.getUser("usuario");
            const amount = interaction.options.getInteger("cantidad");

            if (userId === recipientUser.id) {
                return await interaction.reply({
                    content: "❌ No puedes transferir dinero a ti mismo.",
                    ephemeral: true
                });
            }

            if (moneyData[userId].balance < amount) {
                return await interaction.reply({
                    content: `❌ No tienes suficientes monedas para transferir **${amount}**. Tu balance actual es de **${moneyData[userId].balance}** monedas.`,
                    ephemeral: true
                });
            }

            if (!moneyData[recipientUser.id]) {
                moneyData[recipientUser.id] = {
                    username: recipientUser.username,
                    displayName: recipientUser.displayName,
                    balance: 0,
                    last_daily: null,
                    last_job: null
                };
            }

            moneyData[userId].balance -= amount;
            moneyData[recipientUser.id].balance += amount;
            await writeMoneyFile(moneyData);

            const embed = new EmbedBuilder()
                .setTitle("💸 Transferencia Exitosa")
                .setDescription(`Has transferido **${amount}** monedas a **${recipientUser.displayName}**.`)
                .addFields(
                    { name: 'Tu nuevo balance', value: `**${moneyData[userId].balance}** monedas.`, inline: true },
                    { name: 'Balance del receptor', value: `**${moneyData[recipientUser.id].balance}** monedas.`, inline: true }
                )
                .setColor("Blue")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } else if (subcommandGroup === 'manage') {
            if (!allowedUsers.includes(userId)) {
                return await interaction.reply({
                    content: "❌ No tienes permiso para usar este comando de gestión.",
                    ephemeral: true
                });
            }

            if (subcommand === 'view') {
                const fileContent = JSON.stringify(moneyData, null, 2);
                
                const embed = new EmbedBuilder()
                    .setTitle("📁 Contenido de `money.json`")
                    .setDescription(`\`\`\`json\n${fileContent}\n\`\`\``)
                    .setColor("Blurple")
                    .setTimestamp();
                
                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'edit') {
                const userToEdit = interaction.options.getUser("usuario");
                const newAmount = interaction.options.getInteger("cantidad");

                if (!moneyData[userToEdit.id]) {
                    moneyData[userToEdit.id] = { 
                        username: userToEdit.username,
                        displayName: userToEdit.displayName,
                        balance: 0, 
                        last_daily: null, 
                        last_job: null 
                    };
                }

                moneyData[userToEdit.id].balance = newAmount;
                moneyData[userToEdit.id].username = userToEdit.username;
                moneyData[userToEdit.id].displayName = userToEdit.displayName;
                
                await writeMoneyFile(moneyData);

                const embed = new EmbedBuilder()
                    .setTitle("✏️ Balance Editado")
                    .setDescription(`El balance de **${userToEdit.displayName}** ha sido actualizado a **${newAmount}** monedas.`)
                    .setColor("DarkBlue")
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        }
    },
};
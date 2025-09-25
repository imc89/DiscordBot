const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");
const { MongoClient } = require("mongodb");

// Define los IDs de los usuarios que pueden usar el comando de gestión
const allowedUsers = ['852486349520371744', '1056942076480201801'];

// Configura tu cadena de conexión a MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_USER}.patcutg.mongodb.net/?retryWrites=true&w=majority&appName=${process.env.DB_USER}`;
const client = new MongoClient(uri);

// Array con mensajes y recompensas para el comando de trabajo
const jobRewards = [
    { message: "Has encontrado **{amount}**$ perdidas. ¡Qué suerte!", amount: 50 },
    { message: "Por un pequeño trabajo te han dado **{amount}**$.", amount: 125 },
    { message: "Ayudaste a un bot a resolver un problema técnico y te recompensó con **{amount}**$.", amount: 75 },
    { message: "Has limpiado los canales de spam y te han pagado **{amount}**$.", amount: 100 },
    { message: "Un usuario te pagó **{amount}**$ por un buen consejo.", amount: 60 },
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
        .addSubcommand(subcommand =>
            subcommand
                .setName('game')
                .setDescription('Desafía a un usuario a un juego de adivinar PAR o IMPAR.')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('El usuario al que quieres desafiar.')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('numero')
                        .setDescription('El número que crees que saldrá (1-20).')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(20)
                )
                .addIntegerOption(option =>
                    option.setName('cantidad')
                        .setDescription('La cantidad de monedas a apostar.')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rank')
                .setDescription('Muestra el ranking de los usuarios más ricos.')
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
        await client.connect();
        const db = client.db("discord_bot");
        const collection = db.collection("money");

        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        let userData = await collection.findOne({ userId });

        if (!userData) {
            userData = {
                userId,
                username: interaction.user.username,
                displayName: interaction.user.displayName,
                balance: 0,
                last_daily: null,
                last_job: null
            };
            await collection.insertOne(userData);
        }

        if (subcommand === 'daily') {
            const lastDaily = userData.last_daily;
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
            const newBalance = userData.balance + dailyReward;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance, last_daily: now.toISOString() } }
            );

            const embed = new EmbedBuilder()
                .setTitle("🎁 Recompensa Diaria")
                .setDescription(`Has reclamado tu recompensa de **${dailyReward}** monedas. Tu nuevo balance es de **${newBalance}** monedas.`)
                .setColor("Gold")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'job') {
            const lastJob = userData.last_job;
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
            const newBalance = userData.balance + jobReward;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance, last_job: now.toISOString() } }
            );

            const embed = new EmbedBuilder()
                .setTitle("💼 Resultado del Trabajo")
                .setDescription(randomReward.message.replace('{amount}', Math.abs(jobReward)))
                .addFields({
                    name: 'Balance Actual',
                    value: `Tu nuevo balance es de **${newBalance}** monedas.`,
                })
                .setColor(jobReward >= 0 ? "Orange" : "Red")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'balance') {
            const user = interaction.options.getUser("usuario") || interaction.user;
            const targetId = user.id;

            let targetData = await collection.findOne({ userId: targetId });

            let balance = targetData ? targetData.balance : 0;
            let usernameToDisplay = targetData ? targetData.displayName : user.displayName;

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

            if (userData.balance < amount) {
                return await interaction.reply({
                    content: `❌ No tienes suficientes monedas para transferir **${amount}**. Tu balance actual es de **${userData.balance}** monedas.`,
                    ephemeral: true
                });
            }

            let recipientData = await collection.findOne({ userId: recipientUser.id });
            if (!recipientData) {
                recipientData = {
                    userId: recipientUser.id,
                    username: recipientUser.username,
                    displayName: recipientUser.displayName,
                    balance: 0,
                    last_daily: null,
                    last_job: null
                };
                await collection.insertOne(recipientData);
            }

            const newSenderBalance = userData.balance - amount;
            const newRecipientBalance = recipientData.balance + amount;

            await collection.updateOne({ userId }, { $set: { balance: newSenderBalance } });
            await collection.updateOne({ userId: recipientUser.id }, { $set: { balance: newRecipientBalance } });

            const embed = new EmbedBuilder()
                .setTitle("💸 Transferencia Exitosa")
                .setDescription(`Has transferido **${amount}** monedas a **${recipientUser.displayName}**.`)
                .addFields(
                    { name: 'Tu nuevo balance', value: `**${newSenderBalance}** monedas.`, inline: true },
                    { name: 'Balance del receptor', value: `**${newRecipientBalance}** monedas.`, inline: true }
                )
                .setColor("Blue")
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (subcommand === 'game') {
            const recipientUser = interaction.options.getUser("usuario");
            const number = interaction.options.getInteger("numero");
            const amount = interaction.options.getInteger("cantidad");

            if (userId === recipientUser.id) {
                return await interaction.reply({
                    content: "❌ No puedes apostar contra ti mismo.",
                    ephemeral: true
                });
            }

            if (userData.balance < amount) {
                return await interaction.reply({
                    content: `❌ No tienes suficientes monedas para apostar **${amount}**. Tu balance actual es de **${userData.balance}** monedas.`,
                    ephemeral: true
                });
            }

            let recipientData = await collection.findOne({ userId: recipientUser.id });
            if (!recipientData || recipientData.balance < amount) {
                return await interaction.reply({
                    content: `❌ El usuario **${recipientUser.displayName}** no tiene suficientes monedas para aceptar la apuesta de **${amount}**.`,
                    ephemeral: true
                });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`game_par_${userId}_${recipientUser.id}_${amount}_${number}`)
                        .setLabel('PAR')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`game_impar_${userId}_${recipientUser.id}_${amount}_${number}`)
                        .setLabel('IMPAR')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`game_decline_${userId}_${recipientUser.id}`)
                        .setLabel('Rechazar Apuesta')
                        .setStyle(ButtonStyle.Danger),
                );

            const embed = new EmbedBuilder()
                .setTitle("🎲 ¡Nueva Apuesta!")
                .setDescription(`**${recipientUser.displayName}**, **${interaction.user.displayName}** te ha desafiado a una apuesta de **${amount}** monedas. Adivina si el número que ha escogido es PAR o IMPAR.`)
                .addFields({
                    name: 'Instrucciones',
                    value: `Elige PAR si crees que el número es par, o IMPAR si crees que es impar.`,
                })
                .setColor("Purple")
                .setTimestamp();

            await interaction.reply({
                embeds: [embed],
                components: [row]
            });

        } else if (subcommand === 'rank') {
            const users = await collection.find({}).sort({ balance: -1 }).limit(10).toArray();

            let description = '';
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const member = interaction.guild.members.cache.get(user.userId);
                const rankNumber = i + 1;
                let emoji = '';

                if (rankNumber === 1) emoji = '🏅';
                else if (rankNumber === 2) emoji = '🥈';
                else if (rankNumber === 3) emoji = '🥉';
                else emoji = `${rankNumber}.`;

                const username = member ? member.displayName : user.displayName;
                description += `${emoji} **${username}**: ${user.balance} monedas\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle("🏆 Ranking de Riqueza")
                .setDescription(description || 'Aún no hay usuarios en el ranking.')
                .setColor("Green")
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
                const allUsers = await collection.find({}).toArray();
                const fileContent = JSON.stringify(allUsers, null, 2);

                const embed = new EmbedBuilder()
                    .setTitle("📁 Contenido de la Base de Datos")
                    .setDescription(`\`\`\`json\n${fileContent}\n\`\`\``)
                    .setColor("Blurple")
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });

            } else if (subcommand === 'edit') {
                const userToEdit = interaction.options.getUser("usuario");
                const newAmount = interaction.options.getInteger("cantidad");

                await collection.updateOne(
                    { userId: userToEdit.id },
                    {
                        $set: {
                            balance: newAmount,
                            username: userToEdit.username,
                            displayName: userToEdit.displayName
                        }
                    },
                    { upsert: true }
                );

                const embed = new EmbedBuilder()
                    .setTitle("✏️ Balance Editado")
                    .setDescription(`El balance de **${userToEdit.displayName}** ha sido actualizado a **${newAmount}** monedas.`)
                    .setColor("DarkBlue")
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        }
    },

    async handleButtonInteraction(interaction) {
        // Asegúrate de que la interacción es de un botón y del juego de apuestas
        if (!interaction.isButton() || !interaction.customId.startsWith('game_')) return;

        // 1. Difiera la respuesta inmediatamente para evitar el error de "Interacción fallida".
        await interaction.deferReply({ ephemeral: true });

        // Descomponer los argumentos del customId
        console.log("hola",interaction.customId.split('_'))
        const [action, challengerId, opponentId, amountStr, numberStr] = interaction.customId.split('_');
        const amount = parseInt(amountStr);
        const number = parseInt(numberStr);

        // 2. Verificar si el usuario que hizo clic es el oponente.
        console.log('ID del que pulsó:', interaction.user.id);
        console.log('ID del oponente esperado:', opponentId);
        if (interaction.user.id !== opponentId) {
            return await interaction.editReply({
                content: "❌ Esta apuesta no es para ti."
            });
        }

        await client.connect();
        const db = client.db("discord_bot");
        const collection = db.collection("money");

        const challengerData = await collection.findOne({ userId: challengerId });
        const opponentData = await collection.findOne({ userId: opponentId });

        // 3. Verificar si ambos jugadores tienen suficientes fondos ANTES de procesar.
        if (!challengerData || challengerData.balance < amount || !opponentData || opponentData.balance < amount) {
            await interaction.message.edit({ components: [] }); // Desactivar botones
            return await interaction.editReply({
                content: "❌ Uno de los jugadores no tiene suficientes monedas para continuar con la apuesta."
            });
        }

        // 4. Lógica para el botón de rechazo
        if (action === 'decline') {
            const declineEmbed = new EmbedBuilder()
                .setTitle('❌ Apuesta Rechazada')
                .setDescription(`**${interaction.user.displayName}** ha rechazado la apuesta de **${amount}** monedas.`)
                .setColor('Red');

            await interaction.message.edit({ embeds: [declineEmbed], components: [] });
            return await interaction.editReply({ content: '✅ Has rechazado la apuesta.' });
        }

        // 5. Lógica principal del juego (PAR o IMPAR)
        const isEven = number % 2 === 0;
        const opponentGuessEven = action === 'par';

        let resultMessage;
        let winnerId;
        let loserId;
        let winnerUser;
        let loserUser;

        if ((isEven && opponentGuessEven) || (!isEven && !opponentGuessEven)) {
            // El oponente adivinó correctamente
            winnerId = opponentId;
            loserId = challengerId;
            winnerUser = interaction.user;
            loserUser = await interaction.client.users.fetch(challengerId);
            resultMessage = `🎉 ¡Victoria! **${winnerUser.displayName}** ha adivinado correctamente. El número era **${number}** y es ${isEven ? 'PAR' : 'IMPAR'}.`;
        } else {
            // El oponente se equivocó
            winnerId = challengerId;
            loserId = opponentId;
            winnerUser = await interaction.client.users.fetch(challengerId);
            loserUser = interaction.user;
            resultMessage = `❌ ¡Derrota! **${loserUser.displayName}** se ha equivocado. El número era **${number}** y es ${isEven ? 'PAR' : 'IMPAR'}.`;
        }

        // 6. Actualizar balances en la base de datos
        await collection.updateOne({ userId: winnerId }, { $inc: { balance: amount } });
        await collection.updateOne({ userId: loserId }, { $inc: { balance: -amount } });

        // 7. Recuperar balances actualizados para mostrar el resultado
        const newWinnerData = await collection.findOne({ userId: winnerId });
        const newLoserData = await collection.findOne({ userId: loserId });

        // 8. Crear y enviar embed del resultado
        const resultEmbed = new EmbedBuilder()
            .setTitle('🎲 Resultado de la Apuesta')
            .setDescription(resultMessage)
            .addFields(
                { name: `Balance de ${winnerUser.displayName}`, value: `**${newWinnerData.balance}** monedas`, inline: true },
                { name: `Balance de ${loserUser.displayName}`, value: `**${newLoserData.balance}** monedas`, inline: true }
            )
            .setColor(isEven ? 'LuminousVividPink' : 'DarkVividPink')
            .setTimestamp();

        await interaction.message.edit({ embeds: [resultEmbed], components: [] });
        await interaction.editReply({ content: '✅ La apuesta ha sido procesada.' });
    }
};
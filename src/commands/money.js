const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require("discord.js");
const { MongoClient } = require("mongodb");

// Define los IDs de los usuarios que pueden usar el comando de gestión
const allowedUsers = ['852486349520371744', '1056942076480204801'];

// Configura tu cadena de conexión a MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_USER}.patcutg.mongodb.net/?retryWrites=true&w=majority&appName=${process.env.DB_USER}`;
const client = new MongoClient(uri);

// Array con mensajes y recompensas para el comando de trabajo
const jobRewards = [
    // --- Ganancias significativas (Raras, +250 a +400) ---
    { message: "¡Éxito! Has completado un trabajo de **alto riesgo** para un cliente secreto. Ganancia espectacular de **{amount}**$.", amount: 4000 },
    { message: "Mientras buscabas, encontraste una **caja fuerte abandonada** con **{amount}**$.", amount: 2500 },
    
    // --- Ganancias normales (Comunes, +75 a +150) ---
    { message: "Has entregado varios pedidos y recibido tu **paga semanal de {amount}**$.", amount: 1500 },
    { message: "Terminaste tu turno. Es un **día lento**, pero ganas **{amount}**$.", amount: 750 },
    { message: "Desactivaste un software malicioso de un usuario. Te recompensó con **{amount}**$.", amount: 1000 },
    { message: "Te enfrentaste a un ladrón y recuperaste un botín. La policía te dio una recompensa de **{amount}**$.", amount: 1200 },

    // --- Resultados Neutros (Muy Comunes, 0) ---
    { message: "Tu trabajo fue **cancelado** por problemas técnicos. No ganas, pero tampoco pierdes.", amount: 0 },

    // --- Pérdidas (Negativos, -100 a -300) ---
    { message: "Recibiste una multa por **tráfico ilegal de datos** en tu trabajo. Has perdido **{amount}**$.", amount: -1000 },
    { message: "Fallaste un cálculo y tienes que **cubrir los daños** de un cliente. Pierdes **{amount}**$.", amount: -1500 },
    { message: "¡Oops! Una auditoría inesperada te obliga a pagar **impuestos atrasados** por **{amount}**$.", amount: -3000 }, // Pérdida alta
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
        .addSubcommand(subcommand =>
            subcommand
                .setName('slot')
                .setDescription('Juega a las tragamonedas para ganar o perder monedas.')
                .addIntegerOption(option =>
                    option.setName("cantidad")
                        .setDescription("La cantidad de monedas a apostar.")
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('rob')
                .setDescription('Intenta robarle a otro usuario.')
                .addUserOption(option =>
                    option.setName("usuario")
                        .setDescription("El usuario al que quieres robar.")
                        .setRequired(true)
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
        // Deferir la respuesta para evitar el timeout de 3 segundos, lo cual es vital.
        await interaction.deferReply({ ephemeral: false });

        await client.connect();
        const db = client.db("discord_bot");
        const collection = db.collection("money");

        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        let userData = await collection.findOne({ userId });

        // Si el usuario no existe, se crea un nuevo documento
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

                return await interaction.editReply({
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

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'job') {
            const lastJob = userData.last_job;
            const now = new Date();
            const jobCooldownInMs = 2 * 60 * 60 * 1000;

            if (lastJob && (now.getTime() - new Date(lastJob).getTime()) < jobCooldownInMs) {
                const timeLeft = jobCooldownInMs - (now.getTime() - new Date(lastJob).getTime());
                const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                return await interaction.editReply({
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

            await interaction.editReply({ embeds: [embed] });

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

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'transfer') {
            const recipientUser = interaction.options.getUser("usuario");
            const amount = interaction.options.getInteger("cantidad");

            if (userId === recipientUser.id) {
                return await interaction.editReply({
                    content: "❌ No puedes transferir dinero a ti mismo.",
                    ephemeral: true
                });
            }

            if (userData.balance < amount) {
                return await interaction.editReply({
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

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommand === 'game') {
            const recipientUser = interaction.options.getUser("usuario");
            const number = interaction.options.getInteger("numero");
            const amount = interaction.options.getInteger("cantidad");


            if (userId === recipientUser.id) {
                return await interaction.editReply({
                    content: "❌ No puedes apostar contra ti mismo.",
                    ephemeral: true
                });
            }

            if (userData.balance < amount) {
                return await interaction.editReply({
                    content: `❌ No tienes suficientes monedas para apostar **${amount}**. Tu balance actual es de **${userData.balance}** monedas.`,
                    ephemeral: true
                });
            }

            let recipientData = await collection.findOne({ userId: recipientUser.id });
            if (!recipientData || recipientData.balance < amount) {
                return await interaction.editReply({
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

            await interaction.editReply({
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

            await interaction.editReply({ embeds: [embed] });

        } else if (subcommandGroup === 'manage') {
            if (!allowedUsers.includes(userId)) {
                return await interaction.editReply({
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

                await interaction.editReply({ embeds: [embed] });

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

                await interaction.editReply({ embeds: [embed] });
            }
        } else if (subcommand === 'slot') {
            const amount = interaction.options.getInteger("cantidad");

            if (userData.balance < amount) {
                return await interaction.editReply({
                    content: `❌ No tienes suficientes monedas para apostar **${amount}**. Tu balance actual es de **${userData.balance}** monedas.`,
                    ephemeral: true
                });
            }

            const emojis = ['🍒', '🍋', '🔔', '💎', '🍀'];
            const reel = [
                emojis[Math.floor(Math.random() * emojis.length)],
                emojis[Math.floor(Math.random() * emojis.length)],
                emojis[Math.floor(Math.random() * emojis.length)]
            ];
            const reelString = reel.join(' | ');

            let resultMessage;
            let winAmount = 0;
            let color = "Red";

            if (reel[0] === reel[1] && reel[1] === reel[2]) {
                if (reel[0] === '💎') {
                    winAmount = amount * 10;
                    resultMessage = `🎉 ¡JACKPOT! Has ganado **${winAmount}** monedas.`;
                    color = "Gold";
                } else {
                    winAmount = amount * 4;
                    resultMessage = `🎉 ¡Has sacado triple! Has ganado **${winAmount}** monedas.`;
                    color = "Green";
                }
            } else if (reel[0] === reel[1] || reel[1] === reel[2] || reel[0] === reel[2]) {
                winAmount = amount * 2;
                resultMessage = `🥳 ¡Has sacado doble! Has ganado **${winAmount}** monedas.`;
                color = "Blue";
            } else {
                winAmount = -amount;
                resultMessage = `😔 Has perdido **${amount}** monedas.`;
            }

            const newBalance = userData.balance + winAmount;
            await collection.updateOne(
                { userId },
                { $set: { balance: newBalance } }
            );

            const embed = new EmbedBuilder()
                .setTitle("🎰 Tragamonedas")
                .setDescription(resultMessage)
                .addFields(
                    { name: 'Resultado del carrete', value: `\`${reelString}\`` },
                    { name: 'Balance Actual', value: `Tu nuevo balance es de **${newBalance}** monedas.` }
                )
                .setColor(color)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } else if (subcommand === 'rob') {
            const targetUser = interaction.options.getUser("usuario");
            const targetId = targetUser.id;

            if (userId === targetId) {
                return await interaction.editReply({
                    content: "❌ No puedes robarte a ti mismo.",
                    ephemeral: true
                });
            }

            let targetData = await collection.findOne({ userId: targetId });

            if (!targetData || targetData.balance < 100) {
                return await interaction.editReply({
                    content: `❌ El usuario **${targetUser.displayName}** no tiene suficientes monedas para ser robado (necesita al menos 100 monedas).`,
                    ephemeral: true
                });
            }

            const robSuccess = Math.random() < 0.4; // 40% de probabilidad de éxito
            let robAmount;
            let newRobberBalance;
            let newTargetBalance;
            let embed;

            // Rango de porcentaje a robar de la víctima: 10% a 20%
            const MIN_ROB_PERCENT = 0.10;
            const MAX_ROB_PERCENT = 0.20;

            // Rango de porcentaje de penalización del ladrón: 15% a 30%
            const MIN_PENALTY_PERCENT = 0.15;
            const MAX_PENALTY_PERCENT = 0.30;
            // Penalización mínima garantizada (para que los balances bajos sigan sintiendo el castigo)
            const MIN_FLAT_PENALTY = 100;


            if (robSuccess) {
                // 1. Calcula el porcentaje aleatorio a robar (entre 10% y 20%)
                const robPercentage = Math.random() * (MAX_ROB_PERCENT - MIN_ROB_PERCENT) + MIN_ROB_PERCENT;

                // 2. Calcula la cantidad real basada en el balance de la VÍCTIMA
                let robAmount = Math.floor(targetData.balance * robPercentage);

                // Aseguramos que la cantidad robada no sea cero si el porcentaje es pequeño
                if (robAmount < 1) robAmount = 1;

                newRobberBalance = userData.balance + robAmount;
                newTargetBalance = targetData.balance - robAmount;

                // Si la víctima queda con balance negativo (teóricamente no debería pasar si tiene más de 100)
                if (newTargetBalance < 0) newTargetBalance = 0;

                await collection.updateOne({ userId }, { $set: { balance: newRobberBalance } });
                await collection.updateOne({ userId: targetId }, { $set: { balance: newTargetBalance } });

                embed = new EmbedBuilder()
                    .setTitle("🔪 Robo Exitoso")
                    .setDescription(`¡Has logrado robarle **${robAmount}** monedas a **${targetUser.displayName}**!`)
                    .addFields(
                        { name: `Tu nuevo balance`, value: `**${newRobberBalance}** monedas`, inline: true },
                        { name: `Balance de ${targetUser.displayName}`, value: `**${newTargetBalance}** monedas`, inline: true }
                    )
                    .setColor("Green")
                    .setTimestamp();
            } else {
                // 1. Calcula el porcentaje aleatorio de penalización (entre 15% y 30%)
                const penaltyPercentage = Math.random() * (MAX_PENALTY_PERCENT - MIN_PENALTY_PERCENT) + MIN_PENALTY_PERCENT;

                // 2. Calcula la cantidad real basada en el balance del LADRÓN
                let penaltyAmount = Math.floor(userData.balance * penaltyPercentage);

                // 3. Aplica una penalización mínima si la cantidad calculada es demasiado baja
                if (penaltyAmount < MIN_FLAT_PENALTY) {
                    penaltyAmount = MIN_FLAT_PENALTY;
                }

                newRobberBalance = userData.balance - penaltyAmount;

                // Evita que el balance del ladrón sea negativo
                if (newRobberBalance < 0) {
                    // La penalización real es solo lo que le quedaba al usuario
                    penaltyAmount = userData.balance;
                    newRobberBalance = 0;
                }

                await collection.updateOne({ userId }, { $set: { balance: newRobberBalance } });

                embed = new EmbedBuilder()
                    .setTitle("🚔 Robo Fallido")
                    .setDescription(`¡Fuiste atrapado intentando robarle a **${targetUser.displayName}** y tuviste que pagar una multa de **${penaltyAmount}** monedas!`)
                    .addFields({
                        name: `Tu nuevo balance`,
                        value: `**${newRobberBalance}** monedas`,
                    })
                    .setColor("Red")
                    .setTimestamp();
            }

            await interaction.editReply({ embeds: [embed] });
        }
    },

    async handleButtonInteraction(interaction) {
        if (!interaction.isButton() || !interaction.customId.startsWith('game_')) return;

        await interaction.deferReply({ ephemeral: true });

        // Descomponer el customId.
        // El orden es: [ prefijo, tipo de apuesta, ID del retador, ID del oponente, cantidad, numero ]
        const parts = interaction.customId.split('_');

        // Validar el formato del customId
        if (parts.length !== 6) {
            return await interaction.editReply({
                content: "❌ Hubo un error procesando la apuesta. Por favor, inicia una nueva."
            });
        }

        const [prefix, action, challengerId, opponentId, amountStr, numberStr] = parts;
        const amount = parseInt(amountStr);
        const number = parseInt(numberStr);

        // Obtener el ID del usuario que hizo clic
        const clickedUserId = interaction.user.id;
        // Verificar si el usuario que hizo clic es el oponente.
        if (clickedUserId !== opponentId) {
            return await interaction.editReply({
                content: "❌ Esta apuesta no es para ti."
            });
        }

        await client.connect();
        const db = client.db("discord_bot");
        const collection = db.collection("money");

        const challengerData = await collection.findOne({ userId: challengerId });
        const opponentData = await collection.findOne({ userId: opponentId });

        // Validar fondos y usuarios
        if (!challengerData || challengerData.balance < amount || !opponentData || opponentData.balance < amount) {
            await interaction.message.edit({ components: [] });
            return await interaction.editReply({
                content: "❌ Uno de los jugadores no tiene suficientes monedas para continuar con la apuesta."
            });
        }

        // Lógica para el botón de rechazo
        if (action === 'decline') {
            const declineEmbed = new EmbedBuilder()
                .setTitle('❌ Apuesta Rechazada')
                .setDescription(`**${interaction.user.displayName}** ha rechazado la apuesta de **${amount}** monedas.`)
                .setColor('Red');

            await interaction.message.edit({ embeds: [declineEmbed], components: [] });
            return await interaction.editReply({ content: '✅ Has rechazado la apuesta.' });
        }

        // Lógica del juego
        const isEven = number % 2 === 0;
        const opponentGuessEven = action === 'par';

        let resultMessage;
        let winnerId;
        let loserId;
        let winnerUser;
        let loserUser;

        if ((isEven && opponentGuessEven) || (!isEven && !opponentGuessEven)) {
            winnerId = opponentId;
            loserId = challengerId;
            winnerUser = interaction.user;
            loserUser = await interaction.client.users.fetch(challengerId);
            resultMessage = `🎉 ¡Victoria! **${winnerUser.displayName}** ha adivinado correctamente. El número era **${number}** y es ${isEven ? 'PAR' : 'IMPAR'}.`;
        } else {
            winnerId = challengerId;
            loserId = opponentId;
            winnerUser = await interaction.client.users.fetch(challengerId);
            loserUser = interaction.user;
            resultMessage = `❌ ¡Derrota! **${loserUser.displayName}** se ha equivocado. El número era **${number}** y es ${isEven ? 'PAR' : 'IMPAR'}.`;
        }

        // Actualizar balances
        await collection.updateOne({ userId: winnerId }, { $inc: { balance: amount } });
        await collection.updateOne({ userId: loserId }, { $inc: { balance: -amount } });

        // Recuperar balances actualizados
        const newWinnerData = await collection.findOne({ userId: winnerId });
        const newLoserData = await collection.findOne({ userId: loserId });

        // Crear y enviar embed del resultado
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
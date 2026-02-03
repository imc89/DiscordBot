const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require("discord.js");

const allowedUsers = ['852486349520371744', '1056942076480204801'];

const jobRewards = [
    { message: "¡Éxito! Has completado un trabajo de **alto riesgo**. Ganancia de **{amount}**$.", amount: 4000 },
    { message: "Encontraste una **caja fuerte abandonada** con **{amount}**$.", amount: 2500 },
    { message: "Has entregado varios pedidos. Paga semanal de **{amount}**$.", amount: 1500 },
    { message: "Terminaste tu turno. Ganas **{amount}**$.", amount: 750 },
    { message: "Desactivaste un software malicioso. Recompensa de **{amount}**$.", amount: 1000 },
    { message: "Recuperaste un botín. Recompensa policial de **{amount}**$.", amount: 1200 },
    { message: "Tu trabajo fue **cancelado**. No ganas nada.", amount: 0 },
    { message: "Multa por **tráfico ilegal de datos**. Pierdes **{amount}**$.", amount: -1000 },
    { message: "Dañaste el equipo de un cliente. Pierdes **{amount}**$.", amount: -1500 },
    { message: "Auditoría inesperada: pagas **impuestos atrasados** por **{amount}**$.", amount: -3000 },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("law_money")
        .setDescription("Gestiona el sistema de dinero del servidor.")
        .addSubcommand(sub => 
            sub.setName('balance')
               .setDescription('Ver balance.')
               .addUserOption(o => o.setName("usuario").setDescription("Usuario a consultar")))
        .addSubcommand(sub => 
            sub.setName('daily')
               .setDescription('Recompensa diaria.'))
        .addSubcommand(sub => 
            sub.setName('job')
               .setDescription('Realizar un trabajo.'))
        .addSubcommand(sub => 
            sub.setName('rank')
               .setDescription('Top usuarios ricos.'))
        .addSubcommand(sub => 
            sub.setName('slot')
               .setDescription('Jugar tragamonedas.')
               .addIntegerOption(o => o.setName("cantidad").setDescription("Cantidad a apostar").setRequired(true).setMinValue(1)))
        .addSubcommand(sub => 
            sub.setName('transfer')
               .setDescription('Enviar dinero a otro usuario.')
               .addUserOption(o => o.setName('usuario').setDescription("El destinatario").setRequired(true))
               .addIntegerOption(o => o.setName('cantidad').setDescription("Monto a enviar").setRequired(true).setMinValue(1)))
        .addSubcommand(sub => 
            sub.setName('rob')
               .setDescription('Intentar robar a alguien.')
               .addUserOption(o => o.setName("usuario").setDescription("Víctima del robo").setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('game')
               .setDescription('Desafío de PAR o IMPAR.')
               .addUserOption(o => o.setName('usuario').setDescription("Oponente").setRequired(true))
               .addIntegerOption(o => o.setName('numero').setDescription("Tu número secreto (1-20)").setRequired(true).setMinValue(1).setMaxValue(20))
               .addIntegerOption(o => o.setName('cantidad').setDescription("Monto de la apuesta").setRequired(true).setMinValue(1)))
        .addSubcommandGroup(group => 
            group.setName('manage')
                 .setDescription('Comandos administrativos.')
                 .addSubcommand(sub => sub.setName('view').setDescription('Ver base de datos.'))
                 .addSubcommand(sub => 
                    sub.setName('edit')
                       .setDescription('Editar balance de un usuario.')
                       .addUserOption(o => o.setName("usuario").setDescription("Usuario a editar").setRequired(true))
                       .addIntegerOption(o => o.setName("cantidad").setDescription("Nuevo balance").setRequired(true)))),

    async execute(interaction, collection) {
        if (!collection) {
            return await interaction.reply({ content: "❌ Error: Base de datos no conectada.", flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const subcommand = interaction.options.getSubcommand();
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const userId = interaction.user.id;

        let userData = await collection.findOne({ userId });
        if (!userData) {
            userData = { userId, username: interaction.user.username, displayName: interaction.user.displayName, balance: 0, last_daily: null, last_job: null };
            await collection.insertOne(userData);
        }

        try {
            if (subcommand === 'daily') {
                const now = new Date();
                const oneDay = 24 * 60 * 60 * 1000;
                if (userData.last_daily && (now - new Date(userData.last_daily)) < oneDay) {
                    return await interaction.editReply({ content: "⏰ Ya reclamaste tu daily hoy." });
                }
                const reward = 200;
                await collection.updateOne({ userId }, { $inc: { balance: reward }, $set: { last_daily: now.toISOString() } });
                await interaction.editReply({ content: `🎁 Recibiste **${reward}** monedas.` });

            } else if (subcommand === 'job') {
                const now = new Date();
                const cooldown = 2 * 60 * 60 * 1000;
                if (userData.last_job && (now - new Date(userData.last_job)) < cooldown) {
                    return await interaction.editReply({ content: "💼 Estás cansado, vuelve más tarde." });
                }
                const res = jobRewards[Math.floor(Math.random() * jobRewards.length)];
                await collection.updateOne({ userId }, { $inc: { balance: res.amount }, $set: { last_job: now.toISOString() } });
                await interaction.editReply({ content: res.message.replace('{amount}', Math.abs(res.amount)) });

            } else if (subcommand === 'balance') {
                const target = interaction.options.getUser("usuario") || interaction.user;
                const data = await collection.findOne({ userId: target.id }) || { balance: 0 };
                await interaction.editReply({ content: `💰 **${target.displayName}** tiene **${data.balance}** monedas.` });

            } else if (subcommand === 'rank') {
                const top = await collection.find().sort({ balance: -1 }).limit(10).toArray();
                const desc = top.map((u, i) => `${i + 1}. **${u.displayName || u.username}**: ${u.balance}`).join('\n');
                const embed = new EmbedBuilder().setTitle("🏆 Top Riqueza").setDescription(desc || "Aún no hay datos.").setColor("Gold");
                await interaction.editReply({ embeds: [embed] });

            } else if (subcommand === 'slot') {
                const bet = interaction.options.getInteger("cantidad");
                if (userData.balance < bet) return await interaction.editReply("❌ No tienes suficiente dinero.");
                
                const icons = ['🍒', '💎', '🔔', '🍀'];
                const r = [icons[Math.floor(Math.random()*4)], icons[Math.floor(Math.random()*4)], icons[Math.floor(Math.random()*4)]];
                let win = -bet;
                if (r[0] === r[1] && r[1] === r[2]) win = r[0] === '💎' ? bet * 10 : bet * 5;
                else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2]) win = bet * 2;

                await collection.updateOne({ userId }, { $inc: { balance: win } });
                await interaction.editReply({ content: `🎰 [ ${r.join(' | ')} ]\n${win > 0 ? `¡Ganaste **${win}** monedas!` : `Perdiste **${bet}** monedas.`}` });

            } else if (subcommand === 'game') {
                const opponent = interaction.options.getUser("usuario");
                const amount = interaction.options.getInteger("cantidad");
                const num = interaction.options.getInteger("numero");

                if (opponent.id === userId) return await interaction.editReply("❌ No puedes jugar contra ti mismo.");
                if (userData.balance < amount) return await interaction.editReply("❌ No tienes saldo suficiente.");

                const oppData = await collection.findOne({ userId: opponent.id });
                if (!oppData || oppData.balance < amount) return await interaction.editReply("❌ El oponente no tiene dinero suficiente.");

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`game_par_${userId}_${opponent.id}_${amount}_${num}`).setLabel('PAR').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`game_impar_${userId}_${opponent.id}_${amount}_${num}`).setLabel('IMPAR').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`game_decline_${userId}_${opponent.id}`).setLabel('Rechazar').setStyle(ButtonStyle.Danger)
                );

                await interaction.editReply({ content: `🎲 **${opponent}**, **${interaction.user.displayName}** te desafía por **${amount}** monedas. ¿El número secreto es PAR o IMPAR?`, components: [row] });

            } else if (subcommandGroup === 'manage') {
                if (!allowedUsers.includes(userId)) return await interaction.editReply("❌ No tienes permisos de administrador.");
                if (subcommand === 'edit') {
                    const target = interaction.options.getUser("usuario");
                    const qty = interaction.options.getInteger("cantidad");
                    await collection.updateOne({ userId: target.id }, { $set: { balance: qty, displayName: target.displayName } }, { upsert: true });
                    await interaction.editReply(`✅ Balance de **${target.displayName}** actualizado a **${qty}**.`);
                }
            }
        } catch (err) {
            console.error(err);
            await interaction.editReply("❌ Hubo un error procesando el comando.");
        }
    },

    async handleButtonInteraction(interaction, collection) {
        if (!collection) return;
        const [,, challengerId, opponentId, amountStr, numberStr] = interaction.customId.split('_');
        const amount = parseInt(amountStr);
        const number = parseInt(numberStr);

        if (interaction.user.id !== opponentId) return await interaction.reply({ content: "❌ Esta no es tu apuesta.", flags: MessageFlags.Ephemeral });

        await interaction.deferUpdate();

        if (interaction.customId.includes('decline')) {
            return await interaction.editReply({ content: "❌ Apuesta rechazada.", components: [] });
        }

        const isEven = number % 2 === 0;
        const guessedEven = interaction.customId.includes('par');
        const won = (isEven && guessedEven) || (!isEven && !guessedEven);

        const winner = won ? opponentId : challengerId;
        const loser = won ? challengerId : opponentId;

        await collection.updateOne({ userId: winner }, { $inc: { balance: amount } });
        await collection.updateOne({ userId: loser }, { $inc: { balance: -amount } });

        await interaction.editReply({
            content: `🎲 El número secreto era **${number}** (${isEven ? 'PAR' : 'IMPAR'}).\n🏆 <@${winner}> ha ganado **${amount}** monedas!`,
            components: []
        });
    }
};
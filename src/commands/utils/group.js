const { ApplicationCommandType, ApplicationCommandOptionType, MessageFlags, Colors } = require('discord.js');
const Group = require('../../../handlers/functions/Games/Groups/Group');

function formaterDate(date = new Date()) {
    return [
        ('0' + date.getDate()).slice(-2),
        ('0' + (date.getMonth() + 1)).slice(-2),
        date.getFullYear()
    ].join('/');
}

module.exports = {
    name: 'group',
    description: 'Gestion des groupes de jeu',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'create',
            description: 'Crée un nouveau groupe',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'nom',
                    description: 'Nom du groupe',
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: 'cout',
                    description: 'Coût d\'adhésion en coins',
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                    min_value: 0
                }
            ]
        },
        {
            name: 'invite',
            description: 'Inviter un joueur',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'joueur',
                    description: 'Joueur à inviter',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: 'remove',
            description: 'Retirer un joueur',
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'joueur',
                    description: 'Joueur à retirer',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: 'disband',
            description: 'Dissoudre le groupe',
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: 'info',
            description: 'Affiche les infos du groupe',
            type: ApplicationCommandOptionType.Subcommand
        }
    ],
    execute: async (client, interaction, args, con) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        switch (subcommand) {
            case 'create':
                const groupName = interaction.options.getString('nom');
                const joinCost = interaction.options.getInteger('cout') || 0;

                const response = await Group.handleGroupRequest(interaction.user.id, userId);
                console.log(response)
                switch (response.statusCode) {
                    case 200:
                        const res = await Group.createGroup(interaction, interaction.user.id, groupName, joinCost);
                        if (res.success) {
                            interaction.reply({
                                components: [
                                    {
                                        type: 17,
                                        accent_color: Colors.Blue,
                                        components: [
                                            {
                                                type: 10,
                                                content: `### Vous venez de créer un groupe (${res.data?.groupName}).`
                                            },
                                            { type: 14, divider: false, spacing: 1 },

                                            // Propriétaire
                                            {
                                                type: 10,
                                                content: `### Propriétaire`
                                            },
                                            {
                                                type: 10,
                                                content: `Créateur du groupe: ${interaction.user}\nIdentifiant du créateur: \`${interaction.user.id}\`\nDate de création du groupe: ${formaterDate()}`
                                            },

                                            { type: 14, divider: false, spacing: 2 },

                                            // Groupe Details
                                            {
                                                type: 10,
                                                content: `### Détails du Groupe`
                                            },
                                            {
                                                type: 10,
                                                content: `Identifiant du groupe: \`${res.data?.groupId}\`\nAccès: **Privé**\nCoût d'adhesion: \`${res.data?.joinCost}\`€`
                                            },

                                            // buttons
                                            { type: 14, divider: false, spacing: 2 },
                                            {
                                                type: 1, // ACTION_ROW
                                                components: [
                                                    {
                                                        type: 2, // BUTTON
                                                        style: 2, // PRIMARY
                                                        custom_id: "group_manage_" + res.data?.groupId,
                                                        label: "Gérer le groupe",
                                                        emoji: "⚙️"
                                                    },
                                                    {
                                                        type: 2, // BUTTON
                                                        style: 5, // LINK
                                                        url: "https://exemple.com/group-rules",
                                                        label: "Voir les règles",
                                                        emoji: "📜"
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ],
                                flags: MessageFlags.IsComponentsV2
                            })
                        }

                        break;

                    case 409:
                        interaction.reply({
                            components: [
                                {
                                    type: 17,
                                    accent_color: Colors.Blue,
                                    components: [
                                        {
                                            type: 10,
                                            content: `### Vous ne pouvez pas créer de groupe.`
                                        },
                                        {
                                            type: 10,
                                            content: `${response.message}`
                                        },
                                    ]
                                }
                            ],
                            flags: MessageFlags.IsComponentsV2
                        })
                        break;
                }
                break;

            case 'invite':
                const targetUser = interaction.options.getUser('joueur');

                if (!targetUser) {
                    return interaction.reply({
                        embeds: [{
                            color: Colors.Red,
                            description: `Un utilisateur est requis lors de cette commande.`
                        }]
                    });
                }

                const res = await Group.handleGroupRequest(interaction.user.id, interaction.user.id);
                if (!res.data) {
                    // no group
                }

                const inviteResult = await Group.inviteMemberGroup(
                    res.data?.existingGroupId,
                    targetUser.id,
                );

                if (!inviteResult.success) {
                    return interaction.reply({
                        embeds: [{
                            color: Colors.Red,
                            description: `Une erreur est survenue lors de l'invitation.`
                        }]
                    });
                }

                try {
                    await targetUser.send({
                        embeds: [{
                            color: Colors.Blue,
                            title: `Invitation au groupe`,
                            description: `Vous avez été invité à rejoindre le groupe !`,
                            fields: [
                                { name: 'Expire dans', value: '1 heure', inline: true },
                                { name: 'Code', value: inviteResult.inviteCode, inline: true }
                            ],
                        }]
                    });
                } catch (err) {
                    console.error('Erreur envoi DM:', err);
                }

                await interaction.reply({
                    embeds: [{
                        color: Colors.Blue,
                        description: `Invitation envoyée à ${targetUser}. *(expire dans 1 heure)*`
                    }]
                });

                break;

            case 'remove':
                // Gestion du retrait
                break;

            case 'disband':
                // Gestion de la dissolution
                break;

            case 'info':
                const infoResult = await Group.handleGroupRequest(interaction.user.id, interaction.user.id);
                if (!infoResult.data) {
                    // no group
                }

                const groupInfo = await Group.getGroup(infoResult.data?.existingGroupId);
                const owner = interaction.guild.members.cache.get(groupInfo.data?.owner.id) || null;

                const memberFields = [];
                const batchSize = 10;
                const memberCount = groupInfo.data.members.length;

                

                interaction.reply({
                    components: [
                        {
                            type: 17,
                            accent_color: Colors.Blue,
                            components: [
                                {
                                    type: 10,
                                    content: `### Propriétaire`
                                },
                                { type: 14, divider: false, spacing: 1 },
                                {
                                    type: 10,
                                    content: `Propriétaire du groupe: ${owner?.user}\nIdentifiant du proriétaire: \`${owner.id}\``
                                },
                                { type: 14, divider: false, spacing: 2 },

                                {
                                    type: 10,
                                    content: `### Détails du groupe`
                                },
                                { type: 14, divider: false, spacing: 1 },
                                { type: 14, divider: false, spacing: 2 },

                                {
                                    type: 10,
                                    content: `### Statistique du groupe`
                                },
                                { type: 14, divider: false, spacing: 1 },
                                {
                                    type: 10,
                                    content: `Membres (${groupInfo.data.stats.memberCount})\n${groupInfo.data?.members.map((player, index) => `${index + 1}. ${player}`).join('\n')}`
                                },
                            ]
                        }
                    ],
                    flags: MessageFlags.IsComponentsV2
                })
                break;
        }
    }
};
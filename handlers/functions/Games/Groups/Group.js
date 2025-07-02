const { connection } = require("../../../..");
const { DateTime } = require('luxon');

const Group = {
    handleGroupRequest: async (ownerId, targetId) => {
        try {
            const [existingGroups] = await connection.promise().query(
                `SELECT group_id FROM user_groups WHERE user_id = ? AND is_owner = TRUE`,
                [ownerId]
            );

            if (existingGroups.length > 0) {
                return {
                    statusCode: 409,
                    success: false,
                    message: "Vous êtes déjà propriétaire d'un groupe. Vous ne pouvez posséder qu'un seul groupe à la fois.",
                    data: {
                        existingGroupId: existingGroups[0].group_id
                    }
                };
            }

            const [memberGroups] = await connection.promise().query(
                `SELECT group_id FROM user_groups WHERE user_id = ? AND is_owner = FALSE`,
                [ownerId]
            );

            if (memberGroups.length > 0) {
                return {
                    statusCode: 403, // Forbidden
                    success: false,
                    message: "Vous êtes déjà membre d'un groupe",
                    data: {
                        currentGroupId: memberGroups[0].group_id
                    }
                };
            }

            return {
                statusCode: 200, // OK
                success: true,
                message: "Vous pouvez créer un nouveau groupe",
                data: null
            };
        } catch (err) {
            console.error("Erreur lors de la vérification du groupe:", err);
            return {
                statusCode: 500, // Internal Server Error
                success: false,
                message: "Erreur serveur lors de la vérification du groupe",
                error: err.message || undefined
            };
        }
    },

    createGroup: async (interaction, userId, groupName, joinCost = 0) => {
        try {

            const [userCheck] = await connection.promise().query(
                `SELECT user_id FROM users WHERE user_id = ?`,
                [userId]
            );

            if (userCheck.length === 0) {
                // Créer l'utilisateur s'il n'existe pas
                await connection.promise().query(
                    `INSERT INTO users (user_id, username, discriminator) VALUES (?, ?, ?)`,
                    [userId, interaction.user.username, interaction.user.discriminator]
                );
            }

            const [createResult] = await connection.promise().query(
                `INSERT INTO guild_groups (name, join_cost) VALUES (?, ?)`,
                [groupName, joinCost]
            );

            const groupId = createResult.insertId;

            // 2. Assignation du propriétaire
            await connection.promise().query(
                `INSERT INTO user_groups (user_id, group_id, is_owner) VALUES (?, ?, TRUE)`,
                [userId, groupId]
            );

            // 4. Retour standardisé
            return {
                success: true,
                data: {
                    groupId: groupId,
                    groupName: groupName,
                    joinCost: joinCost
                }
            };
        } catch (error) {
            console.error('Erreur createGroup:', error);
            return {
                success: false,
                errorCode: 'DB_ERROR',
                error: error.message
            };
        }
    },

    inviteMemberGroup: async (groupId, userId) => {
        try {
            // 1. Vérifier si le groupe existe
            const [group] = await connection.promise().query(
                'SELECT * FROM guild_groups WHERE group_id = ?',
                [groupId]
            );

            if (!group.length) {
                return { success: false, error: 'Groupe non trouvé' };
            }

            // 2. Vérifier si l'utilisateur est déjà membre
            const [existingMember] = await connection.promise().query(
                'SELECT * FROM user_groups WHERE group_id = ? AND user_id = ?',
                [groupId, userId]
            );

            if (existingMember.length) {
                return { success: false, error: 'Utilisateur déjà membre du groupe' };
            }

            // 3. Créer une invitation avec expiration (1 heure)
            const expiresAt = DateTime.now().plus({ hours: 1 }).toSQL();

            await connection.promise().query(
                'INSERT INTO group_invitations (group_id, user_id, expires_at) VALUES (?, ?, ?)',
                [groupId, userId, expiresAt]
            );

            return {
                success: true,
                expiresAt: expiresAt,
                inviteCode: `${groupId}-${userId}-${Date.now()}`
            };

        } catch (error) {
            console.error('Erreur inviteMemberGroup:', error);
            return { success: false, error: 'Erreur serveur' };
        }
    },

    getGroup: async (groupId) => {
        try {
            const [groupData] = await connection.promise().query(
                `SELECT 
                g.group_id,
                g.name,
                g.join_cost,
                g.daily_reward,
                g.role_id,
                g.created_at,
                COUNT(ug.user_id) AS member_count,
                CAST(u.user_id AS CHAR) AS owner_id,
                u.username AS owner_name
            FROM 
                guild_groups g
            LEFT JOIN 
                user_groups ug ON g.group_id = ug.group_id
            LEFT JOIN
                user_groups owner ON g.group_id = owner.group_id AND owner.is_owner = TRUE
            LEFT JOIN
                users u ON owner.user_id = u.user_id
            WHERE 
                g.group_id = ?
            GROUP BY 
                g.group_id`,
                [groupId]
            );

            if (!groupData.length) {
                return { success: false, error: 'Groupe non trouvé' };
            }

            const group = groupData[0];

            const [members] = await connection.promise().query(
                `SELECT 
                u.user_id,
                u.username,
                u.avatar_url,
                ug.is_owner,
                ug.joined_at
            FROM 
                user_groups ug
            JOIN 
                users u ON ug.user_id = u.user_id
            WHERE 
                ug.group_id = ?
            ORDER BY
                ug.is_owner DESC,
                ug.joined_at ASC`,
                [groupId]
            );

            const [invitations] = await connection.promise().query(
                `SELECT 
                invitation_id,
                user_id,
                expires_at
            FROM 
                group_invitations
            WHERE 
                group_id = ?
                AND is_used = FALSE
                AND expires_at > NOW()`,
                [groupId]
            );

            return {
                success: true,
                data: {
                    id: group.group_id,
                    name: group.name,
                    owner: {
                        id: group.owner_id.toString(),
                        username: group.owner_name
                    },
                    stats: {
                        memberCount: group.member_count,
                        joinCost: group.join_cost,
                        dailyReward: group.daily_reward
                    },
                    members: members.map(member => ({
                        id: member.user_id,
                        username: member.username,
                        avatar: member.avatar_url,
                        isOwner: Boolean(member.is_owner),
                        joinedAt: member.joined_at
                    })),
                    invitations: invitations.map(invite => ({
                        id: invite.invitation_id,
                        userId: invite.user_id,
                        expiresAt: invite.expires_at
                    })),
                    createdAt: group.created_at,
                }
            };

        } catch (error) {
            console.error('Erreur dans getGroup:', error);
            return {
                success: false,
                error: 'Erreur lors de la récupération du groupe',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            };
        }
    }
}

module.exports = Group;
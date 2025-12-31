import { Router, Request, Response } from "express";
import { db, COLLECTIONS, getDocument, setDocument } from "../lib/firebase";
import { robloxBotRequest } from "../lib/roblox";

const router = Router();

interface Rule {
  id: string;
  points: number;
  roleId: number;
  roleName: string;
}

interface SuspendedRole {
  roleId: number;
  roleName: string;
}

interface Suspension {
  id: string;
  userId: number;
  username: string;
  previousRoleId: number;
  previousRoleName: string;
  suspendedAt: number;
  expiresAt: number;
}

interface UserPoints {
  odId: number;
  username: string;
  points: number;
  subGroupId?: string;
}

interface SubGroup {
  id: string;
  name: string;
  rules: Rule[];
}

interface GroupAutomation {
  rules: Rule[];
  userPoints: UserPoints[];
  suspendedRole?: SuspendedRole;
  suspensions: Suspension[];
  subGroups?: SubGroup[];
}

async function getAutomationData(groupId: string): Promise<GroupAutomation> {
  return getDocument<GroupAutomation>(COLLECTIONS.GROUP_AUTOMATION, groupId, {
    rules: [],
    userPoints: [],
    suspensions: [],
  });
}

async function saveAutomationData(groupId: string, data: GroupAutomation) {
  const cleanedData = {
    ...data,
    userPoints: data.userPoints.map((user) => {
      const cleanUser: Record<string, unknown> = {
        odId: user.odId,
        username: user.username,
        points: user.points,
      };
      if (user.subGroupId) {
        cleanUser.subGroupId = user.subGroupId;
      }
      return cleanUser;
    }),
  };
  await setDocument(COLLECTIONS.GROUP_AUTOMATION, groupId, cleanedData);
}

// Get automation data
router.get("/:groupId/automation", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  try {
    const data = await getAutomationData(groupId);
    return res.json(data);
  } catch (error) {
    console.error("Error fetching automation data:", error);
    return res.status(500).json({ error: "Failed to fetch automation data" });
  }
});

// Update automation data
router.post("/:groupId/automation", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;
  const { action, ...body } = req.body;

  try {
    const data = await getAutomationData(groupId);

    switch (action) {
      case "addRule": {
        const newRule: Rule = {
          id: crypto.randomUUID(),
          points: body.points,
          roleId: body.roleId,
          roleName: body.roleName,
        };
        data.rules.push(newRule);
        break;
      }

      case "deleteRule": {
        data.rules = data.rules.filter((r) => r.id !== body.ruleId);
        break;
      }

      case "updatePoints": {
        const existingUser = data.userPoints.find(
          (u) =>
            u.odId === body.userId &&
            (body.subGroupId ? u.subGroupId === body.subGroupId : !u.subGroupId)
        );

        if (existingUser) {
          existingUser.points += body.delta;
          if (existingUser.points <= 0) {
            data.userPoints = data.userPoints.filter(
              (u) =>
                !(
                  u.odId === body.userId &&
                  (body.subGroupId ? u.subGroupId === body.subGroupId : !u.subGroupId)
                )
            );
          }
        } else if (body.delta > 0) {
          const newUserPoints: UserPoints = {
            odId: body.userId,
            username: body.username,
            points: body.delta,
          };
          if (body.subGroupId) {
            newUserPoints.subGroupId = body.subGroupId;
          }
          data.userPoints.push(newUserPoints);
        }

        // Check rules for auto-promotion
        const userPoints =
          data.userPoints.find(
            (u) =>
              u.odId === body.userId &&
              (body.subGroupId ? u.subGroupId === body.subGroupId : !u.subGroupId)
          )?.points || 0;

        const rulesToCheck = body.subGroupId
          ? data.subGroups?.find((sg) => sg.id === body.subGroupId)?.rules || []
          : data.rules;

        const applicableRule = rulesToCheck
          .filter((r) => userPoints >= r.points)
          .sort((a, b) => b.points - a.points)[0];

        if (applicableRule) {
          await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${body.userId}`,
            "PATCH",
            { roleId: applicableRule.roleId }
          );
        }
        break;
      }

      case "setSuspendedRole": {
        data.suspendedRole = {
          roleId: body.roleId,
          roleName: body.roleName,
        };
        break;
      }

      case "clearSuspendedRole": {
        delete data.suspendedRole;
        break;
      }

      case "suspend": {
        // Change user's role to suspended role
        if (data.suspendedRole) {
          await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${body.userId}`,
            "PATCH",
            { roleId: data.suspendedRole.roleId }
          );
        }

        const newSuspension: Suspension = {
          id: crypto.randomUUID(),
          userId: body.userId,
          username: body.username,
          previousRoleId: body.previousRoleId,
          previousRoleName: body.previousRoleName,
          suspendedAt: Date.now(),
          expiresAt: Date.now() + body.duration * 60 * 1000,
        };
        data.suspensions.push(newSuspension);
        break;
      }

      case "unsuspend": {
        // Restore user's previous role
        await robloxBotRequest(
          `https://groups.roblox.com/v1/groups/${groupId}/users/${body.userId}`,
          "PATCH",
          { roleId: body.previousRoleId }
        );

        data.suspensions = data.suspensions.filter((s) => s.userId !== body.userId);
        break;
      }

      case "cleanExpiredSuspensions": {
        const now = Date.now();
        const expired = data.suspensions.filter((s) => s.expiresAt <= now);

        for (const suspension of expired) {
          await robloxBotRequest(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${suspension.userId}`,
            "PATCH",
            { roleId: suspension.previousRoleId }
          );
        }

        data.suspensions = data.suspensions.filter((s) => s.expiresAt > now);
        break;
      }

      // Sub-group actions
      case "createSubGroup": {
        if (!data.subGroups) data.subGroups = [];
        data.subGroups.push({
          id: crypto.randomUUID(),
          name: body.name,
          rules: [],
        });
        break;
      }

      case "deleteSubGroup": {
        data.subGroups = data.subGroups?.filter((sg) => sg.id !== body.subGroupId);
        data.userPoints = data.userPoints.filter((u) => u.subGroupId !== body.subGroupId);
        break;
      }

      case "renameSubGroup": {
        const subGroup = data.subGroups?.find((sg) => sg.id === body.subGroupId);
        if (subGroup) {
          subGroup.name = body.name;
        }
        break;
      }

      case "addSubGroupRule": {
        const sg = data.subGroups?.find((s) => s.id === body.subGroupId);
        if (sg) {
          sg.rules.push({
            id: crypto.randomUUID(),
            points: body.points,
            roleId: body.roleId,
            roleName: body.roleName,
          });
        }
        break;
      }

      case "deleteSubGroupRule": {
        const subG = data.subGroups?.find((s) => s.id === body.subGroupId);
        if (subG) {
          subG.rules = subG.rules.filter((r) => r.id !== body.ruleId);
        }
        break;
      }

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    await saveAutomationData(groupId, data);
    return res.json(data);
  } catch (error) {
    console.error("Error updating automation:", error);
    return res.status(500).json({ error: "Failed to update automation" });
  }
});

export default router;

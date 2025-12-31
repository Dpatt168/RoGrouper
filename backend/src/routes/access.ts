import { Router, Request, Response } from "express";
import { db, COLLECTIONS, isSiteAdmin } from "../lib/firebase";
import { getUserGroupRole, isGroupOwner } from "../lib/roblox";

const router = Router();

interface AccessPermissions {
  canKick: boolean;
  canSuspend: boolean;
  canChangeRole: boolean;
  canManagePoints: boolean;
  canManageDivisions: boolean;
  canViewAuditLog: boolean;
  canManageAutomation: boolean;
  canManageAwards: boolean;
}

interface AllowedRole {
  roleId: number;
  roleName: string;
  permissions: AccessPermissions;
}

interface AllowedUser {
  robloxId: string;
  username: string;
  permissions: AccessPermissions;
}

interface AdminRole {
  roleId: number;
  roleName: string;
}

interface AdminUser {
  robloxId: string;
  username: string;
}

interface GroupAccess {
  allowedRoles: AllowedRole[];
  allowedUsers: AllowedUser[];
  adminRoles: AdminRole[];
  adminUsers: AdminUser[];
}

const DEFAULT_PERMISSIONS: AccessPermissions = {
  canKick: true,
  canSuspend: true,
  canChangeRole: true,
  canManagePoints: true,
  canManageDivisions: true,
  canViewAuditLog: true,
  canManageAutomation: true,
  canManageAwards: true,
};

async function getAccessData(groupId: string): Promise<GroupAccess | null> {
  const doc = await db.collection(COLLECTIONS.GROUP_ACCESS).doc(groupId).get();
  if (!doc.exists) return null;
  return doc.data() as GroupAccess;
}

async function canManageAccess(
  groupId: string,
  robloxId: string,
  accessData: GroupAccess | null
): Promise<boolean> {
  if (await isSiteAdmin(robloxId)) return true;
  if (await isGroupOwner(groupId, robloxId)) return true;
  if (!accessData) return false;
  if (accessData.adminUsers.some((u) => u.robloxId === robloxId)) return true;

  const userRole = await getUserGroupRole(groupId, robloxId);
  if (userRole && accessData.adminRoles.some((r) => r.roleId === userRole.roleId)) {
    return true;
  }

  return false;
}

// Get access data and user permissions
router.get("/:groupId/access", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;

  try {
    const accessData = await getAccessData(groupId);
    const isSiteAdminUser = await isSiteAdmin(req.user.robloxId);
    const isOwner = await isGroupOwner(groupId, req.user.robloxId);
    const canManage = await canManageAccess(groupId, req.user.robloxId, accessData);

    // Get user's permissions
    let userPermissions = DEFAULT_PERMISSIONS;
    let isFullAccess = true;

    if (!isSiteAdminUser && !isOwner && accessData) {
      // Check if user has specific permissions
      const userAccess = accessData.allowedUsers.find(
        (u) => u.robloxId === req.user!.robloxId
      );

      if (userAccess) {
        userPermissions = userAccess.permissions;
        isFullAccess = false;
      } else {
        const userRole = await getUserGroupRole(groupId, req.user.robloxId);
        if (userRole) {
          const roleAccess = accessData.allowedRoles.find(
            (r) => r.roleId === userRole.roleId
          );
          if (roleAccess) {
            userPermissions = roleAccess.permissions;
            isFullAccess = false;
          }
        }
      }
    }

    // Get user's rank
    const userRole = await getUserGroupRole(groupId, req.user.robloxId);
    const userRank = isSiteAdminUser ? 255 : userRole?.rank || 0;

    return res.json({
      accessData,
      canManage,
      isOwner,
      isSiteAdmin: isSiteAdminUser,
      userPermissions,
      isFullAccess,
      userRank,
    });
  } catch (error) {
    console.error("Error fetching access data:", error);
    return res.status(500).json({ error: "Failed to fetch access data" });
  }
});

// Update access data
router.post("/:groupId/access", async (req: Request, res: Response) => {
  if (!req.user?.robloxId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { groupId } = req.params;
  const { action, ...body } = req.body;

  try {
    const accessData = await getAccessData(groupId);
    const canManage = await canManageAccess(groupId, req.user.robloxId, accessData);

    if (!canManage) {
      return res.status(403).json({ error: "You don't have permission to manage access" });
    }

    const data: GroupAccess = accessData || {
      allowedRoles: [],
      allowedUsers: [],
      adminRoles: [],
      adminUsers: [],
    };

    switch (action) {
      case "addAllowedRole":
        if (!data.allowedRoles.some((r) => r.roleId === body.roleId)) {
          data.allowedRoles.push({
            roleId: body.roleId,
            roleName: body.roleName,
            permissions: body.permissions || DEFAULT_PERMISSIONS,
          });
        }
        break;

      case "removeAllowedRole":
        data.allowedRoles = data.allowedRoles.filter((r) => r.roleId !== body.roleId);
        break;

      case "updateRolePermissions":
        const role = data.allowedRoles.find((r) => r.roleId === body.roleId);
        if (role) {
          role.permissions = body.permissions;
        }
        break;

      case "addAllowedUser":
        if (!data.allowedUsers.some((u) => u.robloxId === body.robloxId)) {
          data.allowedUsers.push({
            robloxId: body.robloxId,
            username: body.username,
            permissions: body.permissions || DEFAULT_PERMISSIONS,
          });
        }
        break;

      case "removeAllowedUser":
        data.allowedUsers = data.allowedUsers.filter((u) => u.robloxId !== body.robloxId);
        break;

      case "updateUserPermissions":
        const user = data.allowedUsers.find((u) => u.robloxId === body.robloxId);
        if (user) {
          user.permissions = body.permissions;
        }
        break;

      case "addAdminRole":
        if (!data.adminRoles.some((r) => r.roleId === body.roleId)) {
          data.adminRoles.push({
            roleId: body.roleId,
            roleName: body.roleName,
          });
        }
        break;

      case "removeAdminRole":
        data.adminRoles = data.adminRoles.filter((r) => r.roleId !== body.roleId);
        break;

      case "addAdminUser":
        if (!data.adminUsers.some((u) => u.robloxId === body.robloxId)) {
          data.adminUsers.push({
            robloxId: body.robloxId,
            username: body.username,
          });
        }
        break;

      case "removeAdminUser":
        data.adminUsers = data.adminUsers.filter((u) => u.robloxId !== body.robloxId);
        break;

      default:
        return res.status(400).json({ error: "Invalid action" });
    }

    await db.collection(COLLECTIONS.GROUP_ACCESS).doc(groupId).set(data);
    return res.json(data);
  } catch (error) {
    console.error("Error updating access:", error);
    return res.status(500).json({ error: "Failed to update access" });
  }
});

export default router;

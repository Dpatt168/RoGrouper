import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getDocument, setDocument, COLLECTIONS, isSiteAdmin } from "@/lib/firebase";

// Granular permissions that can be assigned
export interface AccessPermissions {
  canKick: boolean;
  canSuspend: boolean;
  canChangeRole: boolean;
  canManagePoints: boolean;
  canManageDivisions: boolean;
  canViewAuditLog: boolean;
  canManageAutomation: boolean;
  canManageAwards: boolean;
}

// Default permissions (all false)
export const DEFAULT_PERMISSIONS: AccessPermissions = {
  canKick: false,
  canSuspend: false,
  canChangeRole: false,
  canManagePoints: false,
  canManageDivisions: false,
  canViewAuditLog: false,
  canManageAutomation: false,
  canManageAwards: false,
};

// Full permissions (all true)
export const FULL_PERMISSIONS: AccessPermissions = {
  canKick: true,
  canSuspend: true,
  canChangeRole: true,
  canManagePoints: true,
  canManageDivisions: true,
  canViewAuditLog: true,
  canManageAutomation: true,
  canManageAwards: true,
};

// Types for group access management
export interface AllowedRole {
  roleId: number;
  roleName: string;
  rank: number;
  permissions: AccessPermissions;
}

export interface AllowedUser {
  robloxId: string;
  username: string;
  displayName?: string;
  addedAt: number;
  addedBy: string;
  permissions: AccessPermissions;
}

export interface AccessAdmin {
  robloxId: string;
  username: string;
  displayName?: string;
  addedAt: number;
  addedBy: string;
}

export interface AdminRole {
  roleId: number;
  roleName: string;
  rank: number;
}

export interface GroupAccess {
  groupId: number;
  ownerId: string; // Roblox user ID of the group owner
  // Users/roles that can access the group management page
  allowedRoles: AllowedRole[];
  allowedUsers: AllowedUser[];
  // Users/roles that can manage the access settings (admins)
  adminUsers: AccessAdmin[];
  adminRoles: AdminRole[];
  updatedAt: number;
}

async function getGroupAccess(groupId: string): Promise<GroupAccess | null> {
  const data = await getDocument<GroupAccess | null>(
    COLLECTIONS.GROUP_ACCESS,
    groupId,
    null
  );
  return data;
}

async function saveGroupAccess(groupId: string, data: GroupAccess): Promise<void> {
  await setDocument(COLLECTIONS.GROUP_ACCESS, groupId, {
    ...data,
    updatedAt: Date.now(),
  });
}

// Check if user is the group owner on Roblox
async function isGroupOwner(groupId: string, robloxId: string): Promise<boolean> {
  try {
    const response = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.owner?.id?.toString() === robloxId;
  } catch {
    return false;
  }
}

// Get user's role in the group
async function getUserGroupRole(groupId: string, robloxId: string): Promise<{ roleId: number; rank: number; name: string } | null> {
  try {
    const response = await fetch(
      `https://groups.roblox.com/v1/users/${robloxId}/groups/roles`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const membership = data.data?.find((g: { group: { id: number }; role: { id: number; rank: number; name: string } }) => 
      g.group.id.toString() === groupId
    );
    return membership ? { roleId: membership.role.id, rank: membership.role.rank, name: membership.role.name } : null;
  } catch {
    return null;
  }
}

// Check if user can manage access settings (is owner, site admin, or designated admin)
async function canManageAccess(
  groupId: string,
  robloxId: string,
  accessData: GroupAccess | null
): Promise<boolean> {
  // Site admin can always manage
  if (await isSiteAdmin(robloxId)) return true;
  
  // Group owner can always manage
  if (await isGroupOwner(groupId, robloxId)) return true;
  
  if (!accessData) return false;
  
  // Check if user is in admin users list
  if (accessData.adminUsers.some(u => u.robloxId === robloxId)) return true;
  
  // Check if user's role is in admin roles list
  const userRole = await getUserGroupRole(groupId, robloxId);
  if (userRole && accessData.adminRoles.some(r => r.roleId === userRole.roleId)) return true;
  
  return false;
}

// Get user's permissions for a group
export async function getUserPermissions(
  groupId: string,
  robloxId: string
): Promise<{ hasAccess: boolean; permissions: AccessPermissions; isFullAccess: boolean }> {
  // Site admin always has full access
  if (await isSiteAdmin(robloxId)) {
    return { hasAccess: true, permissions: FULL_PERMISSIONS, isFullAccess: true };
  }
  
  // Check if user is group owner (rank 255) or high rank (254+)
  const userRole = await getUserGroupRole(groupId, robloxId);
  if (userRole && userRole.rank >= 254) {
    return { hasAccess: true, permissions: FULL_PERMISSIONS, isFullAccess: true };
  }
  
  // Get custom access settings
  const accessData = await getGroupAccess(groupId);
  if (!accessData) {
    return { hasAccess: false, permissions: DEFAULT_PERMISSIONS, isFullAccess: false };
  }
  
  // Check if user is in admin users list (admins get full permissions)
  if (accessData.adminUsers.some(u => u.robloxId === robloxId)) {
    return { hasAccess: true, permissions: FULL_PERMISSIONS, isFullAccess: true };
  }
  
  // Check if user's role is in admin roles list
  if (userRole && accessData.adminRoles.some(r => r.roleId === userRole.roleId)) {
    return { hasAccess: true, permissions: FULL_PERMISSIONS, isFullAccess: true };
  }
  
  // Check if user is in allowed users list
  const allowedUser = accessData.allowedUsers.find(u => u.robloxId === robloxId);
  if (allowedUser) {
    return { 
      hasAccess: true, 
      permissions: allowedUser.permissions || DEFAULT_PERMISSIONS, 
      isFullAccess: false 
    };
  }
  
  // Check if user's role is in allowed roles list
  if (userRole) {
    const allowedRole = accessData.allowedRoles.find(r => r.roleId === userRole.roleId);
    if (allowedRole) {
      return { 
        hasAccess: true, 
        permissions: allowedRole.permissions || DEFAULT_PERMISSIONS, 
        isFullAccess: false 
      };
    }
  }
  
  return { hasAccess: false, permissions: DEFAULT_PERMISSIONS, isFullAccess: false };
}

// Check if user has access to the group management page (legacy function)
export async function hasGroupAccess(
  groupId: string,
  robloxId: string
): Promise<boolean> {
  const { hasAccess } = await getUserPermissions(groupId, robloxId);
  return hasAccess;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessData = await getGroupAccess(groupId);
    const canManage = await canManageAccess(groupId, session.user.robloxId, accessData);
    const isOwner = await isGroupOwner(groupId, session.user.robloxId);
    const isSiteAdminUser = await isSiteAdmin(session.user.robloxId);
    const userPerms = await getUserPermissions(groupId, session.user.robloxId);
    
    // Get user's rank in the group
    const userRole = await getUserGroupRole(groupId, session.user.robloxId);
    const userRank = isSiteAdminUser ? 255 : (userRole?.rank || 0);

    // Return access data with permission info
    return NextResponse.json({
      access: accessData || {
        groupId: parseInt(groupId),
        ownerId: "",
        allowedRoles: [],
        allowedUsers: [],
        adminUsers: [],
        adminRoles: [],
        updatedAt: 0,
      },
      permissions: {
        canManage,
        isOwner,
        isSiteAdmin: isSiteAdminUser,
      },
      userPermissions: userPerms.permissions,
      isFullAccess: userPerms.isFullAccess,
      userRank,
    });
  } catch (error) {
    console.error("Error fetching group access:", error);
    return NextResponse.json(
      { error: "Failed to fetch group access" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await getServerSession(authOptions);
  const { groupId } = await params;

  if (!session?.user?.robloxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    let accessData = await getGroupAccess(groupId);
    
    // Check permissions
    const canManage = await canManageAccess(groupId, session.user.robloxId, accessData);
    const isOwner = await isGroupOwner(groupId, session.user.robloxId);
    const isSiteAdminUser = await isSiteAdmin(session.user.robloxId);

    // Initialize access data if it doesn't exist
    if (!accessData) {
      // Only owner or site admin can create initial access settings
      if (!isOwner && !isSiteAdminUser) {
        return NextResponse.json({ error: "Only group owner can set up access" }, { status: 403 });
      }
      
      accessData = {
        groupId: parseInt(groupId),
        ownerId: session.user.robloxId,
        allowedRoles: [],
        allowedUsers: [],
        adminUsers: [],
        adminRoles: [],
        updatedAt: Date.now(),
      };
    }

    // For admin management actions, require owner or site admin
    const adminActions = ["addAdminUser", "removeAdminUser", "addAdminRole", "removeAdminRole"];
    if (adminActions.includes(body.action) && !isOwner && !isSiteAdminUser) {
      return NextResponse.json(
        { error: "Only group owner or site admin can manage admin access" },
        { status: 403 }
      );
    }

    // For regular access actions, require canManage permission
    if (!canManage) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Handle actions
    switch (body.action) {
      case "addAllowedRole":
        if (!accessData.allowedRoles.some(r => r.roleId === body.roleId)) {
          accessData.allowedRoles.push({
            roleId: body.roleId,
            roleName: body.roleName,
            rank: body.rank,
            permissions: body.permissions || DEFAULT_PERMISSIONS,
          });
        }
        break;

      case "removeAllowedRole":
        accessData.allowedRoles = accessData.allowedRoles.filter(
          r => r.roleId !== body.roleId
        );
        break;

      case "addAllowedUser":
        if (!accessData.allowedUsers.some(u => u.robloxId === body.robloxId)) {
          accessData.allowedUsers.push({
            robloxId: body.robloxId,
            username: body.username,
            displayName: body.displayName,
            addedAt: Date.now(),
            addedBy: session.user.robloxId,
            permissions: body.permissions || DEFAULT_PERMISSIONS,
          });
        }
        break;

      case "removeAllowedUser":
        accessData.allowedUsers = accessData.allowedUsers.filter(
          u => u.robloxId !== body.robloxId
        );
        break;

      case "addAdminUser":
        if (!accessData.adminUsers.some(u => u.robloxId === body.robloxId)) {
          accessData.adminUsers.push({
            robloxId: body.robloxId,
            username: body.username,
            displayName: body.displayName,
            addedAt: Date.now(),
            addedBy: session.user.robloxId,
          });
        }
        break;

      case "removeAdminUser":
        accessData.adminUsers = accessData.adminUsers.filter(
          u => u.robloxId !== body.robloxId
        );
        break;

      case "addAdminRole":
        if (!accessData.adminRoles.some(r => r.roleId === body.roleId)) {
          accessData.adminRoles.push({
            roleId: body.roleId,
            roleName: body.roleName,
            rank: body.rank,
          });
        }
        break;

      case "removeAdminRole":
        accessData.adminRoles = accessData.adminRoles.filter(
          r => r.roleId !== body.roleId
        );
        break;

      case "updateRolePermissions": {
        const roleToUpdate = accessData.allowedRoles.find(r => r.roleId === body.roleId);
        if (roleToUpdate) {
          roleToUpdate.permissions = { ...roleToUpdate.permissions, ...body.permissions };
        }
        break;
      }

      case "updateUserPermissions": {
        const userToUpdate = accessData.allowedUsers.find(u => u.robloxId === body.robloxId);
        if (userToUpdate) {
          userToUpdate.permissions = { ...userToUpdate.permissions, ...body.permissions };
        }
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    await saveGroupAccess(groupId, accessData);

    return NextResponse.json({
      access: accessData,
      permissions: {
        canManage: true,
        isOwner,
        isSiteAdmin,
      },
    });
  } catch (error) {
    console.error("Error updating group access:", error);
    return NextResponse.json(
      { error: "Failed to update group access" },
      { status: 500 }
    );
  }
}

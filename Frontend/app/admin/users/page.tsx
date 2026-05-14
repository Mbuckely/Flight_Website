"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import {
  fetchManagedUsers,
  updateManagedUserRole,
  type ManagedUser,
} from "@/lib/admin-users";
import { canManageUsers, getStoredUser, type UserRole } from "@/lib/auth";

function formatRole(role?: string) {
  if (role === "admin") {
    return "Admin";
  }

  if (role === "manager" || role === "approver") {
    return "Manager";
  }

  return "Employee";
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [actorRole, setActorRole] = useState<UserRole>("employee");
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});

  const loadUsers = useCallback(async () => {
    const currentUser = getStoredUser();

    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (!canManageUsers()) {
      setError("Manager access is required to manage users.");
      setIsReady(true);
      return;
    }

    try {
      const result = await fetchManagedUsers();
      setUsers(result.users);
      setActorRole(result.actorRole);
      setPendingRoles({});
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load user accounts.",
      );
    } finally {
      setIsReady(true);
    }
  }, [router]);

  useEffect(() => {
    void loadUsers();

    window.addEventListener("focus", loadUsers);
    window.addEventListener("pageshow", loadUsers);
    window.addEventListener("authchange", loadUsers);

    return () => {
      window.removeEventListener("focus", loadUsers);
      window.removeEventListener("pageshow", loadUsers);
      window.removeEventListener("authchange", loadUsers);
    };
  }, [loadUsers]);

  const handleRoleChange = async (user: ManagedUser, role: UserRole) => {
    setSavingUserId(user.id);
    setError("");

    try {
      const result = await updateManagedUserRole(user.id, role);
      setUsers((current) =>
        current.map((currentUser) =>
          currentUser.id === user.id ? result.user : currentUser,
        ),
      );
      setPendingRoles((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update role.");
    } finally {
      setSavingUserId(null);
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Sidebar />

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            User Access
          </p>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">
            Manage manager access.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Managers can approve travel requests. Admins can assign any role;
            managers can promote employees to manager.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-500">
            Showing {users.length} user{users.length === 1 ? "" : "s"} from Supabase.
          </p>
          {error && (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="mt-6 rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh users
          </button>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>User</span>
            <span>Phone</span>
            <span>Role</span>
            <span>Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {users.map((user) => {
              const isSaving = savingUserId === user.id;
              const savedRole = user.role === "approver" ? "manager" : user.role;
              const selectedRole = pendingRoles[user.id] ?? savedRole;
              const hasPendingRole = selectedRole !== savedRole;
              const canAdminAssign = actorRole === "admin";
              const canManagerPromote =
                actorRole === "manager" &&
                user.role !== "manager" &&
                user.role !== "admin";

              return (
                <article
                  key={user.id}
                  className="grid gap-4 px-6 py-5 text-sm text-slate-700 md:grid-cols-[1.4fr_1fr_0.8fr_1fr] md:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">
                      {user.name}
                    </p>
                    <p className="truncate text-slate-500">{user.email}</p>
                  </div>
                  <p>{user.phone || "Not provided"}</p>
                  <p className="font-semibold text-slate-900">
                    {formatRole(user.role)}
                  </p>
                  <div>
                    {canAdminAssign ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          value={selectedRole}
                          disabled={isSaving}
                          onChange={(event) =>
                            setPendingRoles((current) => ({
                              ...current,
                              [user.id]: event.target.value as UserRole,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                          <option value="employee">Employee</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          type="button"
                          disabled={isSaving || !hasPendingRole}
                          onClick={() => void handleRoleChange(user, selectedRole)}
                          className="rounded-xl bg-blue-900 px-4 py-2 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {isSaving ? "Saving..." : "Save"}
                        </button>
                      </div>
                    ) : canManagerPromote ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleRoleChange(user, "manager")}
                        className="rounded-xl bg-blue-900 px-4 py-2 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-blue-400"
                      >
                        {isSaving ? "Saving..." : "Make manager"}
                      </button>
                    ) : (
                      <span className="text-slate-400">No action</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

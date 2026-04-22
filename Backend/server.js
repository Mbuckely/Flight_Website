import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";

dotenv.config();

const app = express();

/********************************************************************************************/
/* MIDDLEWARE */
/********************************************************************************************/

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

const managerEmailAllowlist = (process.env.MANAGER_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function resolveSignupRole(email) {
  return managerEmailAllowlist.includes(normalizeEmail(email)) ? "manager" : "employee";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isApprovalRole(role) {
  return role === "approver" || role === "manager";
}

function buildRoute(fromLocation, toLocation) {
  return `${normalizeText(fromLocation)} to ${normalizeText(toLocation)}`;
}

function toApprovalRequest(row) {
  return {
    id: row.id,
    title: row.title,
    submittedBy: row.submitted_by,
    approverEmail: row.approver_email,
    approverName: row.approver_name,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    route: row.route,
    travelDates: row.travel_dates,
    roomRequirement: row.room_requirement,
    travelers: Array.isArray(row.travelers) ? row.travelers : [],
    bookingDetails: row.booking_details ?? {},
    reason: row.reason,
    status: row.status,
    requestedAt: row.requested_at,
    itineraryShared: row.itinerary_shared,
  };
}

function toApprovalRow(input) {
  const fromLocation = normalizeText(input.fromLocation);
  const toLocation = normalizeText(input.toLocation);
  const row = {
    title: normalizeText(input.title) || `${toLocation} travel request`,
    submitted_by: normalizeText(input.submittedBy),
    approver_email: normalizeEmail(input.approverEmail),
    approver_name: normalizeText(input.approverName),
    from_location: fromLocation,
    to_location: toLocation,
    route: buildRoute(fromLocation, toLocation),
    travel_dates: normalizeText(input.travelDates),
    room_requirement: normalizeText(input.roomRequirement),
    travelers: Array.isArray(input.travelers)
      ? input.travelers.map(normalizeText).filter(Boolean)
      : [],
    reason: normalizeText(input.reason),
    status: input.status ?? "Pending",
    requested_at:
      normalizeText(input.requestedAt) ||
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    itinerary_shared: Boolean(input.itineraryShared),
    updated_at: new Date().toISOString(),
  };

  if (input.bookingDetails && typeof input.bookingDetails === "object") {
    row.booking_details = input.bookingDetails;
  }

  return row;
}

function toApprovalUpdateRow(input, existingRequest) {
  const nextRequest = {
    ...toApprovalRequest(existingRequest),
    ...input,
  };

  const row = toApprovalRow(nextRequest);

  if (!("bookingDetails" in input)) {
    delete row.booking_details;
  }

  return row;
}

async function getProfileByEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { profile: null, error: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, phone, first_name, last_name, role")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  return { profile, error };
}

function isApprovalOwnedByUser(request, profile) {
  const identifiers = [
    normalizeEmail(profile?.email),
    normalizeText(`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`).toLowerCase(),
  ].filter(Boolean);

  const submittedBy = normalizeText(request.submittedBy).toLowerCase();
  const travelers = request.travelers.map((traveler) =>
    normalizeText(traveler).toLowerCase(),
  );

  return identifiers.some(
    (identifier) => submittedBy === identifier || travelers.includes(identifier),
  );
}

function isApprovalAssignedToApprover(request, profile) {
  return normalizeEmail(request.approverEmail) === normalizeEmail(profile?.email);
}

async function findAuthUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (authUser) => normalizeEmail(authUser.email) === normalizedEmail,
    );

    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }

  return null;
}

async function createAuthUser({ email, password }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) {
    return { data, error: null };
  }

  const isAlreadyRegistered = error.message
    .toLowerCase()
    .includes("already been registered");

  if (!isAlreadyRegistered) {
    return { data: null, error };
  }

  const existingAuthUser = await findAuthUserByEmail(email);

  if (!existingAuthUser) {
    return { data: null, error };
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", existingAuthUser.id)
    .maybeSingle();

  if (profileLookupError || existingProfile) {
    return { data: null, error };
  }

  await supabase.auth.admin.deleteUser(existingAuthUser.id);

  return supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
}

/********************************************************************************************/
/* HEALTH CHECK */
/********************************************************************************************/

app.get("/", (req, res) => {
  res.send("Backend is running");
});

/********************************************************************************************/
/* PROFILE ROUTE */
/********************************************************************************************/

app.get("/profile", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.query.email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    const { profile, error } = await getProfileByEmail(normalizedEmail);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ profile });
  } catch (err) {
    console.error("Profile lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/profile", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const phone = normalizeText(req.body.phone);

    if (!normalizedEmail) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const updates = {
      phone,
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
    };

    const { data: profile, error } = await supabase
      .from("profiles")
      .update(updates)
      .ilike("email", normalizedEmail)
      .select("email, phone, first_name, last_name, role")
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({ profile });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/managers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, role")
      .in("role", ["manager", "approver"])
      .order("first_name", { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const managers = (data ?? []).map((profile) => {
      const name = normalizeText(
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`,
      );

      return {
        email: profile.email,
        name: name || profile.email,
        role: profile.role,
      };
    });

    return res.json({ managers });
  } catch (err) {
    console.error("Manager lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* APPROVAL REQUEST ROUTES */
/********************************************************************************************/

app.get("/approval-requests", async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    const { profile, error: profileError } = await getProfileByEmail(email);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const { data, error } = await supabase
      .from("approval_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const requests = (data ?? []).map(toApprovalRequest);
    const visibleRequests = isApprovalRole(profile.role)
      ? requests.filter((request) => isApprovalAssignedToApprover(request, profile))
      : requests.filter((request) => isApprovalOwnedByUser(request, profile));

    return res.json({ requests: visibleRequests });
  } catch (err) {
    console.error("Approval request lookup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/approval-requests", async (req, res) => {
  try {
    const row = {
      id: `approval-${Date.now()}`,
      ...toApprovalRow(req.body),
      created_at: new Date().toISOString(),
    };

    if (
      !row.submitted_by ||
      !row.from_location ||
      !row.to_location ||
      !row.travel_dates ||
      !row.room_requirement ||
      !row.approver_email ||
      row.travelers.length === 0
    ) {
      return res.status(400).json({ error: "Please complete all request fields" });
    }

    const { data, error } = await supabase
      .from("approval_requests")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ request: toApprovalRequest(data) });
  } catch (err) {
    console.error("Approval request creation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.patch("/approval-requests/:id", async (req, res) => {
  try {
    const actorEmail = normalizeEmail(req.body.actorEmail);
    const { profile, error: profileError } = await getProfileByEmail(actorEmail);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    if (!profile) {
      return res.status(403).json({ error: "Profile access is required" });
    }

    const { data: existingRequest, error: existingRequestError } = await supabase
      .from("approval_requests")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (existingRequestError) {
      return res.status(400).json({ error: existingRequestError.message });
    }

    const existingApproval = toApprovalRequest(existingRequest);
    const isAssignedApprover =
      isApprovalRole(profile.role) &&
      normalizeEmail(existingRequest.approver_email) === normalizeEmail(profile.email);
    const isRequesterCancelling =
      req.body.status === "Cancelled" && isApprovalOwnedByUser(existingApproval, profile);

    if (!isAssignedApprover && !isRequesterCancelling) {
      return res.status(403).json({ error: "This request is assigned to another approver" });
    }

    const updates = toApprovalUpdateRow(req.body, existingRequest);

    const { data, error } = await supabase
      .from("approval_requests")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ request: toApprovalRequest(data) });
  } catch (err) {
    console.error("Approval request update error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* SIGNUP ROUTE */
/********************************************************************************************/

app.post("/signup", async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const trimmedPhone = typeof phone === "string" ? phone.trim() : "";

    // 1. Validate input early (fail fast)
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!trimmedPhone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // 2. Create auth user
    const { data, error } = await createAuthUser({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const userId = data.user?.id;

    if (!userId) {
      return res.status(500).json({ error: "User creation failed" });
    }

    // Remove a stale profile left behind when a test auth user was deleted manually.
    await supabase
      .from("profiles")
      .delete()
      .eq("email", normalizedEmail)
      .neq("id", userId);

    const role = resolveSignupRole(normalizedEmail);

    // 3. Insert profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email: normalizedEmail,
      phone: trimmedPhone,
      first_name: firstName,
      last_name: lastName,
      role,
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return res.status(400).json({ error: profileError.message });
    }

    // 4. Respond immediately after core work is done
    return res.status(201).json({
      message: "User created successfully",
      userId,
      role,
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* LOGIN ROUTE */
/********************************************************************************************/

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate early
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone, first_name, last_name, role")
      .eq("id", data.user.id)
      .maybeSingle();

    return res.json({
      message: "Login successful",
      session: data.session,
      user: data.user,
      profile,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/********************************************************************************************/
/* START SERVER */
/********************************************************************************************/

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

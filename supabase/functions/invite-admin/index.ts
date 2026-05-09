import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteAdminRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Invite admin function called");

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token to check if they're admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      console.error("User is not an admin:", roleError);
      return new Response(
        JSON.stringify({ error: "Only admins can invite new admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email }: InviteAdminRequest = await req.json();
    console.log("Inviting admin:", email);

    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    const existingUser = existingUsers.users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    let resetLink: string;
    const siteUrl = Deno.env.get("SITE_URL") || "https://gym-zen-fees.lovable.app";

    if (existingUser) {
      console.log("User exists, generating password reset link");
      
      // Grant admin role if not already
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", existingUser.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!existingRole) {
        const { error: insertError } = await adminClient
          .from("user_roles")
          .insert({ user_id: existingUser.id, role: "admin" });

        if (insertError) {
          console.error("Error inserting admin role:", insertError);
          throw insertError;
        }
      }

      // Generate password reset link
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: {
          redirectTo: `${siteUrl}/admin/auth?mode=reset`,
        },
      });

      if (linkError) {
        console.error("Error generating reset link:", linkError);
        throw linkError;
      }

      resetLink = linkData.properties.action_link;
    } else {
      console.log("Creating new user and generating invite link");
      
      // Create new user with random password (they'll set their own)
      const tempPassword = crypto.randomUUID();
      
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: true,
      });

      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }

      // Grant admin role
      const { error: insertError } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role: "admin" });

      if (insertError) {
        console.error("Error inserting admin role:", insertError);
        throw insertError;
      }

      // Generate password reset link for new user to set their password
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: {
          redirectTo: `${siteUrl}/admin/auth?mode=reset`,
        },
      });

      if (linkError) {
        console.error("Error generating invite link:", linkError);
        throw linkError;
      }

      resetLink = linkData.properties.action_link;
    }

    console.log("Sending email to:", normalizedEmail);

    // Send email with Resend
    const emailResponse = await resend.emails.send({
      from: "Admin Invite <onboarding@resend.dev>",
      to: [normalizedEmail],
      subject: "You've been invited as an Admin",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome, Admin!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #eee; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              You've been invited to join as an administrator. Click the button below to set up your password and access the admin panel.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                Set Your Password
              </a>
            </div>
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              This link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; text-align: center;">
              Gym Management System
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingUser 
          ? "Password reset link sent to existing user" 
          : "Invitation sent to new admin user"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in invite-admin function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to invite admin" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

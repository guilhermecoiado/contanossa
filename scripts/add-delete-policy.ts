import { createClient } from "@supabase/supabase-js";

const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL") || "your-supabase-url";
const supabaseAnonKey =
  Deno.env.get("VITE_SUPABASE_ANON_KEY") || "your-anon-key";
const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "your-service-key";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function addDeletePolicy() {
  const sql = `
DROP POLICY IF EXISTS "family transfer delete creditor" ON public.family_transfer_requests;
CREATE POLICY "family transfer delete creditor"
  ON public.family_transfer_requests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.members m
      WHERE m.id = creditor_member_id
        AND m.auth_user_id = auth.uid()
    )
  );
  `;

  try {
    const { data, error } = await (supabase as any).rpc("execute_sql", {
      sql,
    });

    if (error) {
      console.error("Error executing policy:", error);
    } else {
      console.log("Policy added successfully!");
    }
  } catch (err) {
    console.error(
      "Note: execute_sql RPC may not exist. Please run the SQL manually in Supabase dashboard."
    );
    console.log("SQL to execute:");
    console.log(sql);
  }
}

addDeletePolicy();

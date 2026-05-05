#!/usr/bin/env node

/**
 * Script para adicionar DELETE policy à tabela family_transfer_requests
 * Execute com: node scripts/add-delete-policy.js
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "❌ Missing environment variables: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  console.log(
    "\nPlease run this in your Supabase dashboard SQL editor instead:"
  );
  console.log(`
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
  `);
  process.exit(1);
}

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
    // Use Supabase's admin API to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/pg_execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
        "X-Client-Info": "supabase-js/2.0",
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("✅ DELETE policy added successfully!");
  } catch (err) {
    console.error("❌ Error executing policy:", err.message);
    console.log("\nSQL to execute manually in Supabase dashboard:");
    console.log(sql);
    process.exit(1);
  }
}

addDeletePolicy();

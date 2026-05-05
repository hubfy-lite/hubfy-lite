import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Campos comuns obrigatórios (PF e PJ)
const REQUIRED_COMMON = [
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "taxpayer_id",
  "birthdate",
  "address_line1",
  "address_city",
  "address_state",
  "address_postal_code",
  "bank_code",
  "bank_agency",
  "bank_account",
];

const REQUIRED_INDIVIDUAL = [...REQUIRED_COMMON];

const REQUIRED_BUSINESS = [
  ...REQUIRED_COMMON,
  "ein",
  "business_name",
  "business_phone",
  "business_email",
  "business_opening_date",
  "revenue",
  "main_activity",
  "business_address_line1",
  "business_address_city",
  "business_address_state",
  "business_address_postal_code",
];

type SubmitRequest = {
  tenant_id: string;
  seller_id: string;
};

/* ─── Main handler ─── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed", code: "method_not_allowed" });
  }

  try {
    // 1. Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse body
    const body = (await req.json()) as SubmitRequest;
    if (!body?.tenant_id || !body?.seller_id) {
      return respond(400, { error: "tenant_id and seller_id are required", code: "missing_required_field" });
    }

    // 3. Validate editor
    await authorizeWorkspace(identity, body.tenant_id, supabaseAdmin, { minRole: "editor" });

    // 4. Fetch seller
    const { data: seller, error: sellerError } = await supabaseAdmin
      .from("sellers")
      .select("*")
      .eq("id", body.seller_id)
      .eq("tenant_id", body.tenant_id)
      .single();

    if (sellerError || !seller) {
      return respond(404, { error: "Seller not found", code: "seller_not_found" });
    }

    // 5. Idempotency: if already pending, don't re-submit
    if (seller.status === "pending") {
      return respond(200, { success: true, seller_id: body.seller_id, already_pending: true });
    }

    // 6. Validate status allows submission
    if (!["draft", "rejected"].includes(seller.status)) {
      return respond(400, {
        error: "Seller cannot be submitted in this status",
        code: "invalid_seller_status",
      });
    }

    // 7. Validate required fields
    const requiredFields =
      seller.type === "business" ? REQUIRED_BUSINESS : REQUIRED_INDIVIDUAL;

    const missingFields = requiredFields.filter(
      (field: string) => !seller[field] && seller[field] !== 0
    );

    if (missingFields.length > 0) {
      return respond(400, {
        error: "Required fields are missing",
        code: "missing_required_field",
        missing_fields: missingFields,
      });
    }

    // 8. Validate documents based on selected combo
    const { data: docs } = await supabaseAdmin
      .from("seller_documents")
      .select("*")
      .eq("seller_id", body.seller_id);

    const categories = (docs || []).map((d: { category: string }) => d.category);

    const comboRequired: Record<string, string[]> = {
      selfie_cnh_full: ["selfie", "cnh_full"],
      selfie_cnh_front_back: ["selfie", "cnh_front", "cnh_back"],
      selfie_rg_front_back: ["selfie", "rg_front", "rg_back"],
    };

    const docType = seller.identity_doc_type as string | null;
    if (!docType || !comboRequired[docType]) {
      return respond(400, {
        error: "Identity document type not selected",
        code: "missing_required_documents",
        missing_documents: ["identity_doc_type"],
      });
    }

    const requiredDocs = comboRequired[docType];
    const missingDocs = requiredDocs.filter((cat: string) => !categories.includes(cat));

    if (missingDocs.length > 0) {
      return respond(400, {
        error: "Required documents are missing",
        code: "missing_required_documents",
        missing_documents: missingDocs,
      });
    }

    // 9. Auto-resolve MCC from CNAE (internal enrichment)
    if (!seller.mcc) {
      const cnaeData = seller.cnae as { main?: { id?: string } } | null;
      const cnaeCode = cnaeData?.main?.id ?? null;

      if (cnaeCode) {
        const { data: mccRow } = await supabaseAdmin
          .from("cnae_mcc")
          .select("mcc")
          .eq("cnae", cnaeCode)
          .limit(1)
          .maybeSingle();

        if (mccRow?.mcc) {
          await supabaseAdmin
            .from("sellers")
            .update({ mcc: mccRow.mcc })
            .eq("id", body.seller_id);

          console.log(`Auto-resolved MCC ${mccRow.mcc} from CNAE ${cnaeCode}`);
        }
      }
    }

    // 10. Update status to pending
    const { error: updateError } = await supabaseAdmin
      .from("sellers")
      .update({
        status: "pending",
        submitted_at: new Date().toISOString(),
        rejected_at: null,
        rejection_reason: null,
      })
      .eq("id", body.seller_id);

    if (updateError) {
      console.error("Failed to update seller status:", updateError);
      return respond(500, { error: "Failed to record submission. Please try again.", code: "internal_error" });
    }

    // 11. The pg_net trigger on sellers table (status → pending) will
    // async call seller-provider-submit to send data to Chargefy.
    return respond(200, { success: true, seller_id: body.seller_id });
  } catch (error) {
    console.error("seller-submit error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});

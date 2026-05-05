import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/* ─── Chargefy helpers ─── */

// SDK v1.2.0: production = https://app.chargefy.io/api
const CHARGEFY_BASE_URL = "https://app.chargefy.io/api";

function digitsOnly(val: string | null): string {
  return (val ?? "").replace(/\D/g, "");
}

function buildAddress(
  line1: string | null,
  line2: string | null,
  line3: string | null,
  neighborhood: string | null,
  city: string | null,
  state: string | null,
  postalCode: string | null,
) {
  return {
    street: line1 ?? "",
    number: line2 ?? "",
    ...(line3 ? { complement: line3 } : {}),
    neighborhood: neighborhood ?? "",
    city: city ?? "",
    state: state ?? "",
    postal_code: digitsOnly(postalCode),
  };
}

function buildChargefyPayload(
  seller: Record<string, unknown>,
  tenant: { id: string; name: string },
) {
  const fullName = `${seller.first_name ?? ""} ${seller.last_name ?? ""}`.trim();
  const personalAddress = buildAddress(
    seller.address_line1 as string,
    seller.address_line2 as string,
    seller.address_line3 as string,
    seller.address_neighborhood as string,
    seller.address_city as string,
    seller.address_state as string,
    seller.address_postal_code as string,
  );

  const payload: Record<string, unknown> = {
    organization: {
      name: tenant.name,
      slug: tenant.id,
      email: seller.type === "business"
        ? (seller.business_email as string)
        : (seller.email as string),
    },
    invite_email: seller.email as string,
    seller_type: seller.type as string,
    fee_percent: 0,
    bank_account: {
      holder_name: fullName,
      taxpayer_id: digitsOnly(
        seller.type === "business"
          ? (seller.ein as string)
          : (seller.taxpayer_id as string)
      ),
      bank_code: String(seller.bank_code ?? "").padStart(3, "0"),
      routing_number: digitsOnly(seller.bank_agency as string),
      account_number: seller.bank_account as string,
      account_type: (seller.bank_account_type as string) ?? "checking",
    },
  };

  if (seller.type === "individual") {
    payload.individual = {
      full_name: fullName,
      email: seller.email as string,
      phone: digitsOnly(seller.phone_number as string),
      cpf: digitsOnly(seller.taxpayer_id as string),
      birth_date: seller.birthdate as string,
      address: personalAddress,
      ...(seller.mcc ? { mcc: seller.mcc as string } : {}),
      ...(seller.statement_descriptor ? { statement_descriptor: seller.statement_descriptor as string } : {}),
    };
  } else {
    const businessAddress = buildAddress(
      seller.business_address_line1 as string,
      seller.business_address_line2 as string,
      seller.business_address_line3 as string,
      seller.business_address_neighborhood as string,
      seller.business_address_city as string,
      seller.business_address_state as string,
      seller.business_address_postal_code as string,
    );

    payload.business = {
      cnpj: digitsOnly(seller.ein as string),
      business_name: seller.business_name as string,
      ...(seller.statement_descriptor ? { trading_name: seller.statement_descriptor as string } : {}),
      business_email: seller.business_email as string,
      business_phone: digitsOnly(seller.business_phone as string),
      business_opening_date: seller.business_opening_date as string,
      ...(seller.mcc ? { mcc: seller.mcc as string } : {}),
      ...(seller.statement_descriptor ? { statement_descriptor: seller.statement_descriptor as string } : {}),
      business_address: businessAddress,
      owner: {
        full_name: fullName,
        email: seller.email as string,
        phone: digitsOnly(seller.phone_number as string),
        cpf: digitsOnly(seller.taxpayer_id as string),
        birth_date: seller.birthdate as string,
        address: personalAddress,
      },
    };
  }

  return payload;
}

/** Map Hubfy doc category to Chargefy KYC type */
function mapDocToChargefyType(category: string): string | null {
  const categoryMap: Record<string, string> = {
    selfie: "SELFIE",
    cnh_full: "CNH_FULL",
    cnh_front: "CNH_FRONT",
    cnh_back: "CNH_BACK",
    rg_front: "RG_FRONT",
    rg_back: "RG_BACK",
  };
  return categoryMap[category] ?? null;
}

/** Step 1: Create Chargefy suborganization via SDK v1.2.0 endpoint */
async function createChargefyOrg(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ id: string; raw: unknown }> {
  const res = await fetch(`${CHARGEFY_BASE_URL}/v1/sdk/organizations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(`Chargefy create org failed (${res.status}): ${body || "<empty body>"}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`Chargefy create org returned non-JSON body: ${body || "<empty body>"}`);
  }

  // SDK v1.2.0 response: { suborganization: { id, name, slug, status }, api_key, status }
  const suborg = parsed.suborganization as Record<string, unknown> | undefined;
  const id = suborg?.id as string | undefined;

  if (!id) {
    throw new Error(`Chargefy create org returned success without suborganization.id: ${body}`);
  }

  return { id, raw: parsed };
}

/** Step 2: Upload single KYC document via SDK v1.2.0 endpoint (FormData multipart) */
async function uploadKycDoc(
  apiKey: string,
  organizationId: string,
  type: string,
  fileData: Uint8Array,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const form = new FormData();
  form.append("organization_id", organizationId);
  form.append("type", type);
  form.append("file", new Blob([fileData], { type: mimeType }), "document");

  const res = await fetch(
    `${CHARGEFY_BASE_URL}/v1/accounts/kyc/documents`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        // Content-Type set automatically by FormData with boundary
      },
      body: form,
    },
  );

  const resBody = await res.text();

  if (!res.ok) {
    throw new Error(`KYC upload ${type} failed (${res.status}): ${resBody}`);
  }

  try {
    return JSON.parse(resBody);
  } catch {
    return { success: true, document_type: type };
  }
}

/* ─── Event logger helper ─── */

async function logEvent(
  admin: ReturnType<typeof createClient>,
  body: { seller_id: string; tenant_id: string },
  eventType: string,
  suborgId: string | null,
  rawPayload: unknown,
  response: unknown,
) {
  try {
    await admin.from("seller_events").insert({
      seller_id: body.seller_id,
      tenant_id: body.tenant_id,
      event_type: eventType,
      event_io: "out",
      suborganization_id: suborgId,
      raw_payload: rawPayload,
      response,
    });
  } catch (e) {
    console.error(`Failed to log event ${eventType}:`, e);
  }
}

/* ─── Main handler ─── */

type ProviderSubmitRequest = {
  seller_id: string;
  tenant_id: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const chargefyApiKey = Deno.env.get("CHARGEFY_API_KEY") ?? "";
  const admin = createClient(supabaseUrl, supabaseServiceKey);

  let body: ProviderSubmitRequest;

  try {
    body = (await req.json()) as ProviderSubmitRequest;
  } catch {
    return respond(400, { error: "Invalid JSON" });
  }

  if (!body?.seller_id || !body?.tenant_id) {
    return respond(400, { error: "seller_id and tenant_id required" });
  }

  let chargefySuborgId: string | null = null;

  try {
    // ── Idempotency: skip if seller.create.submit with success already exists ──
    const { data: existingEvent, error: existingEventError } = await admin
      .from("seller_events")
      .select("id")
      .eq("seller_id", body.seller_id)
      .eq("event_type", "seller.create.submit")
      .eq("event_io", "out")
      .contains("response", { success: true })
      .limit(1)
      .maybeSingle();

    if (existingEventError) {
      throw new Error(`Failed to check seller_events idempotency: ${existingEventError.message}`);
    }

    if (existingEvent) {
      console.log(`Idempotency: seller.create.submit already exists for seller ${body.seller_id}, skipping`);
      return respond(200, { skipped: true, reason: "already_submitted" });
    }

    // ── Skip if no Chargefy API key ──
    if (!chargefyApiKey) {
      console.warn("CHARGEFY_API_KEY not set, skipping provider submission");
      return respond(200, { skipped: true, reason: "no_api_key" });
    }

    // ── Fetch seller ──
    const { data: seller, error: sellerError } = await admin
      .from("sellers")
      .select("*")
      .eq("id", body.seller_id)
      .eq("tenant_id", body.tenant_id)
      .single();

    if (sellerError || !seller) {
      const msg = `Seller not found: ${sellerError?.message ?? "no data"}`;
      console.error(msg);
      await logEvent(admin, body, "seller.create.submit", null, null, { success: false, error: msg });
      return respond(404, { error: "Seller not found" });
    }

    // ── Fetch tenant ──
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .select("id, name")
      .eq("id", body.tenant_id)
      .single();

    if (tenantError || !tenant) {
      const msg = `Tenant not found: ${tenantError?.message ?? "no data"}`;
      console.error(msg);
      await logEvent(admin, body, "seller.create.submit", null, null, { success: false, error: msg });
      return respond(404, { error: "Tenant not found" });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: Create Chargefy suborganization
    // Evento: seller.create.submit (out)
    // ══════════════════════════════════════════════════════════════════
    chargefySuborgId = seller.external_suborganization_id as string | null;
    const chargefyPayload = buildChargefyPayload(seller, tenant);

    console.log("Chargefy submit start", {
      seller_id: body.seller_id,
      seller_type: seller.type,
      has_external_suborganization_id: Boolean(chargefySuborgId),
    });

    if (!chargefySuborgId) {
      try {
        const chargefyResult = await createChargefyOrg(chargefyApiKey, chargefyPayload);
        chargefySuborgId = chargefyResult.id;

        // Save external ID on seller
        const { error: externalIdError } = await admin
          .from("sellers")
          .update({ external_suborganization_id: chargefySuborgId })
          .eq("id", body.seller_id);

        if (externalIdError) {
          throw new Error(
            `Chargefy org ${chargefySuborgId} created but failed to persist: ${externalIdError.message}`,
          );
        }

        // Log success event: seller.create.submit
        await logEvent(admin, body, "seller.create.submit", chargefySuborgId, chargefyPayload, {
          success: true, chargefy_response: chargefyResult.raw,
        });

        console.log(`Chargefy suborganization created: ${chargefySuborgId}`);
      } catch (orgErr) {
        const errorMessage = getErrorMessage(orgErr);
        console.error("Chargefy create org error:", errorMessage);

        // Log failure event: seller.create.submit
        await logEvent(admin, body, "seller.create.submit", null, chargefyPayload, {
          success: false, error: errorMessage,
        });

        return respond(500, { error: errorMessage });
      }
    } else {
      console.log(`Idempotency: Chargefy suborg already exists (${chargefySuborgId}), skipping creation`);

      // Still log the event so seller_events always has the seller.create.submit record
      await logEvent(admin, body, "seller.create.submit", chargefySuborgId, chargefyPayload, {
        success: true, skipped: true, reason: "suborg_already_exists",
      });
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Upload KYC documents (one event per document)
    // Evento: seller.kyc.submit (out) — um por documento
    // ══════════════════════════════════════════════════════════════════
    const comboRequired: Record<string, string[]> = {
      selfie_cnh_full: ["selfie", "cnh_full"],
      selfie_cnh_front_back: ["selfie", "cnh_front", "cnh_back"],
      selfie_rg_front_back: ["selfie", "rg_front", "rg_back"],
    };

    const docType = seller.identity_doc_type as string | null;
    const requiredCategories = docType ? (comboRequired[docType] ?? []) : [];

    const { data: docs, error: docsError } = await admin
      .from("seller_documents")
      .select("*")
      .eq("seller_id", body.seller_id);

    if (docsError) {
      throw new Error(`Failed to fetch seller documents: ${docsError.message}`);
    }

    const docsToUpload = (docs || []).filter(
      (d: { category: string }) => requiredCategories.includes(d.category),
    );

    const kycResults: { type: string; success: boolean; error?: string }[] = [];

    for (const doc of docsToUpload) {
      const chargefyType = mapDocToChargefyType(doc.category);
      if (!chargefyType) continue;

      try {
        // Download from Supabase Storage
        const { data: fileData, error: dlError } = await admin.storage
          .from(doc.bucket)
          .download(doc.object_path);

        if (dlError || !fileData) {
          throw new Error(`Download failed: ${dlError?.message ?? "no data"}`);
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Upload to Chargefy
        const kycResponse = await uploadKycDoc(
          chargefyApiKey, chargefySuborgId!, chargefyType, bytes, doc.mime_type,
        );

        // Log success event: seller.kyc.submit
        await logEvent(admin, body, "seller.kyc.submit", chargefySuborgId, {
          document_type: chargefyType, organization_id: chargefySuborgId,
        }, { success: true, chargefy_response: kycResponse });

        kycResults.push({ type: chargefyType, success: true });
        console.log(`KYC uploaded: ${chargefyType}`);
      } catch (kycErr) {
        const errorMessage = getErrorMessage(kycErr);

        // Log failure event: seller.kyc.submit
        await logEvent(admin, body, "seller.kyc.submit", chargefySuborgId, {
          document_type: chargefyType, organization_id: chargefySuborgId,
        }, { success: false, error: errorMessage });

        kycResults.push({ type: chargefyType, success: false, error: errorMessage });
        console.error(`KYC upload error for ${chargefyType}:`, errorMessage);
        // Continue with next document — don't fail the whole submission
      }
    }

    return respond(200, {
      success: true,
      chargefy_suborg_id: chargefySuborgId,
      kyc_results: kycResults,
    });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error("seller-provider-submit error:", errorMessage);

    // Log any unhandled error as seller.create.submit failure
    await logEvent(admin, body, "seller.create.submit", chargefySuborgId, null, {
      success: false, error: errorMessage,
    });

    return respond(500, { error: errorMessage });
  }
});

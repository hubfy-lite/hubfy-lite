import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateRequest, authorizeWorkspace, toErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/bmp",
  "image/webp",
  "image/heic",
  "image/heif",
];

const PDF_ALLOWED_CATEGORIES = ["cnh_full"];

const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

type UploadRequest = {
  tenant_id: string;
  seller_id: string;
  category: string;
  identity_sub_type?: string;
  filename: string;
  mime_type: string;
  size_bytes?: number;
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    // 1. Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const identity = await authenticateRequest(req, supabaseAdmin);

    // 2. Parse body
    const body = (await req.json()) as UploadRequest;
    if (!body?.tenant_id || !body?.seller_id || !body?.category || !body?.filename || !body?.mime_type) {
      return respond(400, { error: "tenant_id, seller_id, category, filename e mime_type são obrigatórios" });
    }

    // 3. Validate category
    const validCategories = ["selfie", "identity", "cnh_full", "cnh_front", "cnh_back", "rg_front", "rg_back"];
    if (!validCategories.includes(body.category)) {
      return respond(400, { error: `Categoria inválida: ${body.category}` });
    }

    // 4. Validate MIME type
    const mimeLC = body.mime_type.toLowerCase();
    const isPdf = mimeLC === "application/pdf";
    if (!ALLOWED_MIME_TYPES.includes(mimeLC) && !(isPdf && PDF_ALLOWED_CATEGORIES.includes(body.category))) {
      return respond(400, {
        error: isPdf
          ? "PDF é aceito apenas para CNH completa (cnh_full)"
          : "Formato não suportado. Use PNG, JPEG, BMP, WebP, HEIC ou HEIF",
      });
    }

    // 5. Validate size
    if (body.size_bytes && body.size_bytes > MAX_SIZE_BYTES) {
      return respond(400, { error: "Arquivo excede o tamanho máximo de 3MB" });
    }

    // 6. Validate user is editor
    await authorizeWorkspace(identity, body.tenant_id, supabaseAdmin, { minRole: "editor" });

    // 7. Validate seller belongs to tenant and is editable
    const { data: seller, error: sellerError } = await supabaseAdmin
      .from("sellers")
      .select("id, status, tenant_id")
      .eq("id", body.seller_id)
      .eq("tenant_id", body.tenant_id)
      .single();

    if (sellerError || !seller) {
      return respond(404, { error: "Seller não encontrado" });
    }

    if (!["draft", "rejected"].includes(seller.status)) {
      return respond(400, { error: "Documentos só podem ser enviados quando o seller está em rascunho ou rejeitado" });
    }

    // Validate identity_sub_type if provided
    const validSubTypes = ["front", "back", "full"];
    if (body.identity_sub_type && !validSubTypes.includes(body.identity_sub_type)) {
      return respond(400, { error: `identity_sub_type inválido: ${body.identity_sub_type}` });
    }

    // 8. Remove existing document of same category (replace) — for "identity", replace by sub_type
    if (body.category === "identity" && body.identity_sub_type) {
      const { data: existingDocs } = await supabaseAdmin
        .from("seller_documents")
        .select("id, object_path")
        .eq("seller_id", body.seller_id)
        .eq("category", "identity")
        .eq("identity_sub_type", body.identity_sub_type);

      if (existingDocs && existingDocs.length > 0) {
        for (const doc of existingDocs) {
          await supabaseAdmin.storage.from("seller-docs").remove([doc.object_path]);
          await supabaseAdmin.from("seller_documents").delete().eq("id", doc.id);
        }
      }
    } else if (body.category !== "identity") {
      const { data: existingDocs } = await supabaseAdmin
        .from("seller_documents")
        .select("id, object_path")
        .eq("seller_id", body.seller_id)
        .eq("category", body.category);

      if (existingDocs && existingDocs.length > 0) {
        for (const doc of existingDocs) {
          await supabaseAdmin.storage.from("seller-docs").remove([doc.object_path]);
          await supabaseAdmin.from("seller_documents").delete().eq("id", doc.id);
        }
      }
    }

    // 9. Build path and create signed upload URL
    const safeFilename = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const objectPath = `tenant/${body.tenant_id}/${body.seller_id}/${body.category}_${timestamp}_${safeFilename}`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("seller-docs")
      .createSignedUploadUrl(objectPath);

    if (uploadError || !uploadData) {
      console.error("Failed to create upload URL:", uploadError);
      return respond(500, { error: "Falha ao criar URL de upload" });
    }

    // 10. Insert document record
    const { data: docData, error: docError } = await supabaseAdmin
      .from("seller_documents")
      .insert({
        seller_id: body.seller_id,
        category: body.category,
        identity_sub_type: body.identity_sub_type ?? null,
        bucket: "seller-docs",
        object_path: objectPath,
        original_filename: body.filename,
        mime_type: body.mime_type,
        size_bytes: body.size_bytes ?? null,
      })
      .select("id")
      .single();

    if (docError || !docData) {
      console.error("Failed to create document record:", docError);
      return respond(500, { error: "Falha ao registrar documento" });
    }

    return respond(200, {
      document_id: docData.id,
      upload_url: uploadData.signedUrl,
      upload_token: uploadData.token,
      object_path: objectPath,
    });
  } catch (error) {
    console.error("seller-upload-document error:", error);
    return toErrorResponse(error, corsHeaders);
  }
});

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";
import type { Seller, SellerDocumentCategory, SellerType } from "@/types/seller";

/* ─── CNPJA API helper ─── */

interface CnpjaActivity {
  id?: number;
  text?: string;
}

interface CnpjaMember {
  person?: { type?: "NATURAL" | "LEGAL"; name?: string };
  role?: { id?: number; text?: string };
}

interface CnpjaResponse {
  company?: {
    name?: string;
    nature?: { id?: number };
    members?: CnpjaMember[];
  };
  founded?: string;
  address?: {
    street?: string;
    number?: string;
    district?: string;
    city?: string;
    state?: string;
    details?: string;
    zip?: string;
  };
  mainActivity?: CnpjaActivity;
  sideActivities?: CnpjaActivity[];
  phones?: Array<{ area?: string; number?: string }>;
  emails?: Array<{ address?: string }>;
}

/* ─── Representative name extraction ─── */

const ROLE_PRIORITY = [49, 5, 65, 16, 10, 31];
const NAME_PARTICLES = new Set(["da", "de", "do", "dos", "das", "e"]);

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && NAME_PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function splitName(fullName: string): { first_name: string; last_name: string } {
  const titled = toTitleCase(fullName.trim());
  const parts = titled.split(/\s+/);
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") || "" };
}

function extractRepresentativeName(
  data: CnpjaResponse
): { first_name: string; last_name: string } | null {
  const members = data.company?.members;

  // Case 1: has members — pick highest-priority natural person
  if (members && members.length > 0) {
    const natural = members.filter((m) => m.person?.type === "NATURAL" && m.person?.name);
    if (natural.length > 0) {
      natural.sort((a, b) => {
        const aIdx = ROLE_PRIORITY.indexOf(a.role?.id ?? -1);
        const bIdx = ROLE_PRIORITY.indexOf(b.role?.id ?? -1);
        return (aIdx === -1 ? ROLE_PRIORITY.length : aIdx) - (bIdx === -1 ? ROLE_PRIORITY.length : bIdx);
      });
      return splitName(natural[0].person!.name!);
    }
  }

  // Case 2: Empresário Individual (2135) — name embedded in company.name
  if (data.company?.nature?.id === 2135 && data.company?.name) {
    const cleaned = data.company.name.replace(/^[\d.\s]+/, "").trim();
    if (cleaned) return splitName(cleaned);
  }

  return null;
}

/**
 * Fetches CNPJ data from CNPJA open API (1 attempt, no retry).
 * Returns partial seller fields or null on failure.
 */
async function fetchCnpjaData(
  cnpj: string
): Promise<Record<string, unknown> | null> {
  try {
    const digits = cnpj.replace(/\D/g, "");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`https://open.cnpja.com/office/${digits}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data: CnpjaResponse = await res.json();

    const phone = data.phones?.[0];
    const email = data.emails?.[0];
    const addr = data.address;

    const fields: Record<string, unknown> = {};

    if (data.company?.name) fields.business_name = data.company.name;
    if (data.founded) fields.business_opening_date = data.founded.slice(0, 10);
    if (phone) fields.business_phone = `55${phone.area ?? ""}${phone.number ?? ""}`;
    if (email?.address) fields.business_email = email.address;
    // Build CNAE JSONB with main + side activities
    if (data.mainActivity?.id) {
      const main = { id: String(data.mainActivity.id), text: data.mainActivity.text ?? "" };
      const side = (data.sideActivities ?? [])
        .filter((a) => a.id)
        .map((a) => ({ id: String(a.id), text: a.text ?? "" }));
      fields.cnae = { main, side };
      fields.main_activity = main.text;
    }

    // Address (used for business address)
    if (addr) {
      if (addr.street) fields.business_address_line1 = addr.street;
      if (addr.number) fields.business_address_line2 = addr.number;
      if (addr.details) fields.business_address_line3 = addr.details;
      if (addr.district) fields.business_address_neighborhood = addr.district;
      if (addr.city) fields.business_address_city = addr.city;
      if (addr.state) fields.business_address_state = addr.state;
      if (addr.zip) fields.business_address_postal_code = addr.zip;
      fields.business_address_country_code = "BR";
    }

    // Extract legal representative name for owner step
    const rep = extractRepresentativeName(data);
    if (rep) {
      fields.first_name = rep.first_name;
      fields.last_name = rep.last_name;
    }

    return Object.keys(fields).length > 0 ? fields : null;
  } catch {
    // Silently fail — CNPJA enrichment is best-effort
    return null;
  }
}

export function useSeller() {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;
  const queryKey = ["seller", tenantId];

  const fetchSeller = useCallback(async (): Promise<Seller | null> => {
    if (!tenantId) return null;

    const { data, error } = await supabase
      .from("sellers")
      .select("*, seller_documents(*)")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) throw error;
    return data as Seller | null;
  }, [tenantId]);

  const { data: seller, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: fetchSeller,
    enabled: !!tenantId,
    staleTime: 5 * 60_000, // 5 minutes — wizard flow is slow
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  /** Criar seller draft (primeiro passo) */
  const createSeller = async (
    type: SellerType,
    document?: string
  ): Promise<Seller> => {
    if (!tenantId) throw new Error("Tenant não encontrado");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const insertData: Record<string, unknown> = {
      tenant_id: tenantId,
      type,
      status: "draft",
      created_by: user.id,
    };

    // Save CPF (individual) or CNPJ (business) from step 1
    if (document) {
      if (type === "individual") {
        insertData.taxpayer_id = document;
      } else {
        insertData.ein = document;
      }
    }

    // For CNPJ: try to enrich with CNPJA data before inserting
    if (type === "business" && document) {
      const cnpjaData = await fetchCnpjaData(document);
      if (cnpjaData) {
        Object.assign(insertData, cnpjaData);
      }
    }

    const { data, error } = await supabase
      .from("sellers")
      .insert(insertData as any)
      .select("*, seller_documents(*)")
      .single();

    if (error) throw error;

    const result = data as unknown as Seller;
    queryClient.setQueryData(queryKey, result);
    return result;
  };

  /** Salvar dados (somente draft/rejected) */
  const saveDraft = async (updates: Record<string, unknown>): Promise<Seller> => {
    if (!seller) throw new Error("Seller não encontrado");
    if (!canEdit) throw new Error("Seller não pode ser editado neste status");

    const { data, error } = await supabase
      .from("sellers")
      .update(updates as any)
      .eq("id", seller.id)
      .select("*, seller_documents(*)")
      .single();

    if (error) throw error;

    const result = data as unknown as Seller;
    queryClient.setQueryData(queryKey, result);
    return result;
  };

  /** Submeter para aprovação (chama edge function) */
  const submitSeller = async (): Promise<void> => {
    if (!seller || !tenantId) throw new Error("Seller não encontrado");

    await invokeEdgeFunction("seller-submit", {
      body: { tenant_id: tenantId, seller_id: seller.id },
    });

    await refetch();
  };

  /** Solicitar re-aprovação (approved → pending) */
  const requestReapproval = async (): Promise<void> => {
    if (!seller || !tenantId) throw new Error("Seller não encontrado");
    if (seller.status !== "approved") throw new Error("Seller precisa estar aprovado");

    const { error } = await supabase
      .from("sellers")
      .update({
        status: "pending",
        submitted_at: new Date().toISOString(),
      } as any)
      .eq("id", seller.id);

    if (error) throw error;

    await supabase.from("seller_events" as any).insert({
      seller_id: seller.id,
      tenant_id: tenantId,
      event_type: "reapproval_requested",
      internal_status: "pending",
    });

    await refetch();
  };

  /** Upload de documento KYC */
  const uploadDocument = async (
    category: SellerDocumentCategory,
    file: File,
    identitySubType?: "front" | "back" | "full"
  ): Promise<void> => {
    if (!seller || !tenantId) throw new Error("Seller não encontrado");

    // 1. Get signed URL from edge function
    const { data } = await invokeEdgeFunction<{ upload_url: string }>(
      "seller-upload-document",
      {
        body: {
          tenant_id: tenantId,
          seller_id: seller.id,
          category,
          identity_sub_type: identitySubType ?? undefined,
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        },
      },
    );

    // 2. Upload file to signed URL
    const uploadResponse = await fetch(data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error("Falha no upload do arquivo");
    }

    await refetch();
  };

  /** Remover documento */
  const removeDocument = async (documentId: string): Promise<void> => {
    if (!seller) throw new Error("Seller não encontrado");

    const doc = seller.seller_documents?.find((d) => d.id === documentId);
    if (!doc) throw new Error("Documento não encontrado");

    // Remove from storage
    await supabase.storage.from("seller-docs").remove([doc.object_path]);

    // Remove record
    const { error } = await supabase
      .from("seller_documents")
      .delete()
      .eq("id", documentId);

    if (error) throw error;

    await refetch();
  };

  // Computed
  const canEdit = seller?.status === "draft" || seller?.status === "rejected";
  const isApproved = seller?.status === "approved";
  const isPending = seller?.status === "pending";
  const isRejected = seller?.status === "rejected";

  return {
    seller: seller ?? null,
    loading: isLoading,
    error: error as Error | null,
    refetch,

    // Actions
    createSeller,
    saveDraft,
    submitSeller,
    requestReapproval,
    uploadDocument,
    removeDocument,

    // Computed
    canEdit,
    isApproved,
    isPending,
    isRejected,
  };
}

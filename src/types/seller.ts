export type SellerType = "individual" | "business";

export type SellerStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "disabled"
  | "deleted";

export type SellerDocumentCategory =
  | "selfie"
  | "identity"
  // BR (legacy)
  | "cnh_full"
  | "cnh_front"
  | "cnh_back"
  | "rg_front"
  | "rg_back"
  // US (legacy)
  | "ssn"
  | "itin"
  // EU/ES (legacy)
  | "eidas"
  | "ueid_card";

export type IdentityDocType =
  | "selfie_cnh_full"
  | "selfie_cnh_front_back"
  | "selfie_rg_front_back";
export type IdentitySubType = "front" | "back" | "full";

export interface SellerDocument {
  id: string;
  seller_id: string;
  category: SellerDocumentCategory;
  identity_sub_type: IdentitySubType | null;
  bucket: string;
  object_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number | null;
  created_at: string;
}

export interface Seller {
  id: string;
  tenant_id: string;
  type: SellerType;
  status: SellerStatus;

  // Dados pessoais (PF) / Sócio (PJ)
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  taxpayer_id: string | null;
  birthdate: string | null;

  // Negócio
  statement_descriptor: string | null;
  revenue: number | null;
  mcc: string | null;
  cnae: { main: { id: string; text: string }; side: { id: string; text: string }[] } | null;
  main_activity: string | null;

  // Endereço pessoal
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country_code: string | null;

  // Dados empresa (PJ)
  business_name: string | null;
  ein: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_description: string | null;
  business_website: string | null;
  business_opening_date: string | null;

  // Endereço empresa (PJ)
  business_address_line1: string | null;
  business_address_line2: string | null;
  business_address_line3: string | null;
  business_address_neighborhood: string | null;
  business_address_city: string | null;
  business_address_state: string | null;
  business_address_postal_code: string | null;
  business_address_country_code: string | null;

  // Dados bancários
  bank_code: string | null;
  bank_agency: string | null;
  bank_account: string | null;
  bank_account_type: "checking" | "savings";

  // Documentos
  identity_doc_type: IdentityDocType | null;

  // Controle
  external_suborganization_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // Joined
  seller_documents?: SellerDocument[];
}

/** Campos editáveis no formulário */
export type SellerFormData = Omit<
  Seller,
  | "id"
  | "tenant_id"
  | "status"
  | "external_suborganization_id"
  | "submitted_at"
  | "approved_at"
  | "rejected_at"
  | "rejection_reason"
  | "created_at"
  | "updated_at"
  | "created_by"
  | "seller_documents"
>;

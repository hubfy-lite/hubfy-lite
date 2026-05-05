import type { Seller, IdentityDocType, SellerDocumentCategory } from "@/types/seller";

export function validateBusiness(seller: Seller): string[] {
  const missing: string[] = [];
  if (!seller.business_name) missing.push("businessName");
  if (!seller.ein) missing.push("cnpj");
  if (!seller.business_email) missing.push("businessEmail");
  if (!seller.business_phone) missing.push("businessPhone");
  if (!seller.business_opening_date) missing.push("openingDate");
  if (!seller.revenue) missing.push("revenue");
  if (!seller.main_activity) missing.push("mainActivity");
  if (!seller.business_address_line1) missing.push("addressLine1");
  if (!seller.business_address_city) missing.push("city");
  if (!seller.business_address_state) missing.push("state");
  if (!seller.business_address_postal_code) missing.push("postalCode");
  return missing;
}

export function validatePersonal(seller: Seller): string[] {
  const missing: string[] = [];
  if (!seller.first_name) missing.push("firstName");
  if (!seller.last_name) missing.push("lastName");
  if (!seller.email) missing.push("email");
  if (!seller.phone_number) missing.push("phone");
  if (!seller.birthdate) missing.push("birthdate");
  if (!seller.address_line1) missing.push("addressLine1");
  if (!seller.address_city) missing.push("city");
  if (!seller.address_state) missing.push("state");
  if (!seller.address_postal_code) missing.push("postalCode");
  // CPF obrigatório para PF e PJ (responsável legal)
  if (!seller.taxpayer_id) missing.push("cpf");
  return missing;
}

/** Required categories for each document combination */
const COMBO_REQUIRED_CATEGORIES: Record<IdentityDocType, SellerDocumentCategory[]> = {
  selfie_cnh_full: ["selfie", "cnh_full"],
  selfie_cnh_front_back: ["selfie", "cnh_front", "cnh_back"],
  selfie_rg_front_back: ["selfie", "rg_front", "rg_back"],
};

export function validateDocuments(seller: Seller): string[] {
  const docs = seller.seller_documents ?? [];
  const missing: string[] = [];
  const categories = docs.map((d) => d.category);

  // Must have a combo selected
  if (!seller.identity_doc_type) {
    missing.push("docType");
    return missing;
  }

  // Check all required docs for the selected combo
  const required = COMBO_REQUIRED_CATEGORIES[seller.identity_doc_type];
  if (!required) {
    missing.push("docType");
    return missing;
  }

  for (const cat of required) {
    if (!categories.includes(cat)) {
      missing.push(cat);
    }
  }

  return missing;
}

export function validateBank(seller: Seller): string[] {
  const missing: string[] = [];
  if (!seller.bank_code) missing.push("bank");
  if (!seller.bank_agency) missing.push("bankAgency");
  if (!seller.bank_account) missing.push("bankAccount");
  return missing;
}

import { useState } from "react";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";

export interface ImportRowResult {
  line: number;
  email: string;
  status: "created" | "updated" | "skipped" | "error";
  customer_action: string;
  orders_created: string[];
  orders_skipped: string[];
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  success: boolean;
  batch_id: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  orders_created_count: number;
  rows: ImportRowResult[];
}

export interface ImportRow {
  email: string;
  name: string;
  product_ids?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone_country_code?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  document_type?: string | null;
  document?: string | null;
  external_id?: string | null;
}

export function useCustomerImport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importCustomers = async (
    rows: ImportRow[],
    filename: string,
    tenantId: string,
    importType?: "customers" | "contacts",
  ) => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data } = await invokeEdgeFunction<ImportResult>(
        "import-customers-csv",
        {
          body: {
            rows,
            filename,
            tenant_id: tenantId,
            ...(importType ? { import_type: importType } : {}),
          },
        },
      );

      const importResult = data;
      setResult(importResult);
      return importResult;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    importCustomers,
    loading,
    result,
    error,
    reset,
  };
}

import { useSearchParams } from "react-router-dom";
import { ImportContainer } from "./import/ImportContainer";

export default function AdminContactImport() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from");
  const backUrl = from === "email" ? "/admin/email/contacts" : "/admin/customers";

  return <ImportContainer importType="contacts" backUrl={backUrl} />;
}

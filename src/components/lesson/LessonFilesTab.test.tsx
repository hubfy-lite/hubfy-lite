import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: vi.fn() } },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { LessonFilesTab } from "@/components/lesson/LessonFilesTab";
import type { LessonFileAsset } from "@/hooks/useLesson";

function makeFile(overrides: Partial<{
  file: LessonFileAsset["asset"] extends infer A ? A extends { file: infer F } ? F : never : never;
  status: string;
}>): LessonFileAsset {
  return {
    id: "link-1",
    label: "Documento teste",
    sort_order: 0,
    asset: {
      id: "asset-1",
      title: "doc.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
      status: (overrides.status ?? "ready") as any,
      file: overrides.file !== undefined
        ? overrides.file
        : { bucket: "assets", object_path: "files/doc.pdf", original_filename: "doc.pdf" },
    },
  };
}

describe("LessonFilesTab", () => {
  it("renders download button when file exists and status is ready", () => {
    render(<LessonFilesTab files={[makeFile({})]} />);
    const btn = screen.getByRole("button", { name: /baixar/i });
    expect(btn).toBeEnabled();
  });

  it("shows 'Arquivo indisponível' when file is null", () => {
    render(<LessonFilesTab files={[makeFile({ file: null })]} />);
    expect(screen.getByText("Arquivo indisponível")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar/i })).not.toBeInTheDocument();
  });

  it("shows 'Processando...' when status is uploading", () => {
    render(<LessonFilesTab files={[makeFile({ status: "uploading" })]} />);
    expect(screen.getByText("Processando...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar/i })).not.toBeInTheDocument();
  });

  it("shows 'Processando...' when status is processing", () => {
    render(<LessonFilesTab files={[makeFile({ status: "processing" })]} />);
    expect(screen.getByText("Processando...")).toBeInTheDocument();
  });

  it("shows 'Falha no processamento' when status is failed", () => {
    render(<LessonFilesTab files={[makeFile({ status: "failed" })]} />);
    expect(screen.getByText("Falha no processamento")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /baixar/i })).not.toBeInTheDocument();
  });

  it("shows empty state when no files", () => {
    render(<LessonFilesTab files={[]} />);
    expect(screen.getByText("Nenhum arquivo disponível.")).toBeInTheDocument();
  });
});

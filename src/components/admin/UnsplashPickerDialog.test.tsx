import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { searchPhotosMock } = vi.hoisted(() => ({
  searchPhotosMock: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: unknown) => value,
}));

vi.mock("@/lib/unsplash", () => ({
  searchPhotos: (...args: unknown[]) => searchPhotosMock(...args),
  downloadPhoto: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import UnsplashPickerDialog from "@/components/admin/UnsplashPickerDialog";

describe("UnsplashPickerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchPhotosMock.mockResolvedValue({
      total: 0,
      total_pages: 0,
      results: [],
    });
  });

  it("uses the provided default query for wellness categories", async () => {
    render(
      <UnsplashPickerDialog
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        defaultQuery="wellness"
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("wellness", 1, 20, undefined);
    });
  });

  it("uses the provided default query for relationship categories", async () => {
    render(
      <UnsplashPickerDialog
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        defaultQuery="relationship"
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("relationship", 1, 20, undefined);
    });
  });

  it("prefers the user search over the category default query", async () => {
    render(
      <UnsplashPickerDialog
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
        defaultQuery="wellness"
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("wellness", 1, 20, undefined);
    });

    searchPhotosMock.mockClear();

    fireEvent.change(screen.getByPlaceholderText("unsplash.searchPlaceholder"), {
      target: { value: "leadership" },
    });

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("leadership", 1, 20, undefined);
    });
  });

  it("refreshes the fallback search when the category default query changes", async () => {
    const onOpenChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(
      <UnsplashPickerDialog
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        defaultQuery="wellness"
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("wellness", 1, 20, undefined);
    });

    searchPhotosMock.mockClear();

    rerender(
      <UnsplashPickerDialog
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        defaultQuery="relationship"
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("relationship", 1, 20, undefined);
    });
  });

  it("falls back to startup when no default query is provided", async () => {
    render(
      <UnsplashPickerDialog
        open
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(searchPhotosMock).toHaveBeenCalledWith("startup", 1, 20, undefined);
    });
  });
});

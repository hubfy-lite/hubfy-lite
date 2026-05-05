import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Minus,
  ImageIcon,
  Link as LinkIcon,
  Unlink,
  TextAlignStart,
  Code,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { sanitizeLessonHtml } from "@/lib/sanitize-lesson-html";
import { toast } from "sonner";

type ContentMode = "rich" | "html";
type HtmlView = "edit" | "preview";

interface LessonBlocksSectionProps {
  contentHtml: string;
  customHtml: string;
  contentMode: ContentMode;
  onContentHtmlChange: (content: string) => void;
  onCustomHtmlChange: (content: string) => void;
  onContentModeChange: (mode: ContentMode) => void;
}

export function LessonBlocksSection({
  contentHtml,
  customHtml,
  contentMode,
  onContentHtmlChange,
  onCustomHtmlChange,
  onContentModeChange,
}: LessonBlocksSectionProps) {
  const { t } = useTranslation();

  // Sub-view of the HTML mode: edit raw code or preview rendered output.
  // Local only — does not persist anywhere. Default is edit.
  const [htmlView, setHtmlView] = useState<HtmlView>("edit");

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector — two radio cards so the author sees clearly that
          picking one means the other is not rendered to students. */}
      <RadioGroup
        value={contentMode}
        onValueChange={(v) => v && onContentModeChange(v as ContentMode)}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 shrink-0"
      >
        <ModeCard
          value="rich"
          active={contentMode === "rich"}
          icon={<TextAlignStart className="size-4" />}
          title={t("lessonEdit.blocks.mode.rich")}
          description={t("lessonEdit.blocks.mode.richDescription")}
        />
        <ModeCard
          value="html"
          active={contentMode === "html"}
          icon={<Code className="size-4" />}
          title={t("lessonEdit.blocks.mode.html")}
          description={t("lessonEdit.blocks.mode.htmlDescription")}
        />
      </RadioGroup>

      <p className="text-xs text-muted-foreground mb-4 shrink-0">
        {t("lessonEdit.blocks.mode.activeHint")}
      </p>

      {contentMode === "rich" ? (
        <RichEditor content={contentHtml} onContentChange={onContentHtmlChange} />
      ) : (
        <HtmlMode
          customHtml={customHtml}
          onCustomHtmlChange={onCustomHtmlChange}
          view={htmlView}
          onViewChange={setHtmlView}
        />
      )}
    </div>
  );
}

// ── HTML mode wrapper: sub-toolbar [HTML | Visual] + editor OR preview ───
// Sub-toolbar is scoped INSIDE the HTML mode so the author sees it as a
// "view of the HTML customizado", not a global switch.

interface HtmlModeProps {
  customHtml: string;
  onCustomHtmlChange: (content: string) => void;
  view: HtmlView;
  onViewChange: (view: HtmlView) => void;
}

function HtmlMode({ customHtml, onCustomHtmlChange, view, onViewChange }: HtmlModeProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Callout lives above the edit/preview card so it is never hidden
          behind the active view — same treatment as a form-level hint. */}
      <HtmlLimitationsCallout />

      {/* Code/Visual tabs sit directly on top of the editing surface so the
          author reads them as "ways of looking at this HTML", not as a
          lesson-level switch. */}
      <div className="flex items-center gap-1 mb-2 shrink-0">
        <HtmlViewButton
          active={view === "edit"}
          onClick={() => onViewChange("edit")}
          icon={<Code className="size-3.5" />}
          label={t("lessonEdit.blocks.mode.htmlView.edit")}
        />
        <HtmlViewButton
          active={view === "preview"}
          onClick={() => onViewChange("preview")}
          icon={<Eye className="size-3.5" />}
          label={t("lessonEdit.blocks.mode.htmlView.preview")}
        />
      </div>

      <div className="rounded-xl overflow-hidden border border-border bg-card flex flex-col flex-1 min-h-0">
        {view === "edit" ? (
          <textarea
            value={customHtml}
            onChange={(e) => onCustomHtmlChange(e.target.value)}
            placeholder={t("lessonEdit.blocks.mode.htmlPlaceholder")}
            spellCheck={false}
            className="flex-1 w-full resize-none text-sm leading-relaxed px-6 py-4 bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/60"
          />
        ) : (
          <HtmlPreview html={customHtml} />
        )}
      </div>
    </div>
  );
}

// ── HTML view toolbar button ─────────────────────────────────────────

interface HtmlViewButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function HtmlViewButton({ active, onClick, icon, label }: HtmlViewButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-7 gap-1.5 text-xs font-medium hover:bg-muted",
        active && "bg-muted text-foreground"
      )}
    >
      {icon}
      {label}
    </Button>
  );
}

// ── HTML preview (read-only render of customHtml) ────────────────────

function HtmlPreview({ html }: { html: string }) {
  const { t } = useTranslation();
  const sanitized = useMemo(
    () => (html ? sanitizeLessonHtml(html) : ""),
    [html]
  );

  if (!sanitized) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground px-6 py-10">
        {t("lessonEdit.blocks.mode.htmlView.empty")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div
        className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}

// ── Mode selector card ────────────────────────────────────────────────

interface ModeCardProps {
  value: ContentMode;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ModeCard({ value, active, icon, title, description }: ModeCardProps) {
  const id = `lesson-content-mode-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-4 cursor-pointer transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/40"
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <div className="space-y-1 min-w-0">
        <div className="text-base font-medium text-foreground flex items-center gap-2">
          {icon}
          {title}
        </div>
        <div className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </div>
      </div>
    </label>
  );
}

// ── Limitations callout (HTML mode) ───────────────────────────────────

function HtmlLimitationsCallout() {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 shrink-0">
      <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" />
      <div className="space-y-1.5 text-sm">
        <p className="font-medium text-foreground">
          {t("lessonEdit.blocks.mode.limitationsTitle")}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>{t("lessonEdit.blocks.mode.limitationScripts")}</li>
          <li>{t("lessonEdit.blocks.mode.limitationStyles")}</li>
          <li>{t("lessonEdit.blocks.mode.limitationImages")}</li>
          <li>{t("lessonEdit.blocks.mode.limitationForms")}</li>
        </ul>
      </div>
    </div>
  );
}

// ── TipTap rich editor ────────────────────────────────────────────────

interface EditorVariantProps {
  content: string;
  onContentChange: (content: string) => void;
}

function RichEditor({ content, onContentChange }: EditorVariantProps) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const isInitialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: t("lessonEdit.blocks.placeholder"),
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // min-h-full makes the .ProseMirror fill the entire scroll container
        // even when the content is short, so a click anywhere in the card
        // lands on the editor (instead of on dead space that swallows clicks).
        class:
          "prose dark:prose-invert prose-sm sm:prose-base max-w-none focus:outline-none min-h-full px-6 py-4",
      },
    },
  });

  // Initialize content when it changes externally (e.g., on load)
  useEffect(() => {
    if (editor && content && !isInitialized.current) {
      editor.commands.setContent(content);
      isInitialized.current = true;
    }
  }, [editor, content]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!tenant?.id || !editor) return;

      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        toast.error(t("lessonEdit.blocks.image.invalidFormat"));
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("lessonEdit.blocks.image.fileTooLarge"));
        return;
      }

      setUploadingImage(true);

      try {
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const path = `tenant/${tenant.id}/content/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("content-images")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("content-images")
          .getPublicUrl(path);

        if (urlData?.publicUrl) {
          editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
          toast.success(t("lessonEdit.blocks.image.added"));
        }
      } catch (error) {
        console.error("Upload error:", error);
        toast.error(t("lessonEdit.blocks.image.uploadError"));
      } finally {
        setUploadingImage(false);
      }
    },
    [tenant?.id, editor, t]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    e.target.value = "";
  };

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkUrl("");
    setLinkPopoverOpen(false);
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const currentLink = editor.getAttributes("link").href || "";

  return (
    <div className="rounded-xl overflow-hidden border border-border bg-card flex flex-col flex-1">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30 shrink-0">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title={t("lessonEdit.blocks.toolbar.undo")}
        >
          <Undo className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title={t("lessonEdit.blocks.toolbar.redo")}
        >
          <Redo className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive("heading", { level: 1 })}
          title={t("lessonEdit.blocks.toolbar.heading1")}
        >
          <Heading1 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title={t("lessonEdit.blocks.toolbar.heading2")}
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive("heading", { level: 3 })}
          title={t("lessonEdit.blocks.toolbar.heading3")}
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title={t("lessonEdit.blocks.toolbar.bold")}
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title={t("lessonEdit.blocks.toolbar.italic")}
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title={t("lessonEdit.blocks.toolbar.underline")}
        >
          <UnderlineIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title={t("lessonEdit.blocks.toolbar.strikethrough")}
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title={t("lessonEdit.blocks.toolbar.bulletList")}
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title={t("lessonEdit.blocks.toolbar.orderedList")}
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title={t("lessonEdit.blocks.toolbar.quote")}
        >
          <Quote className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          title={t("lessonEdit.blocks.toolbar.alignLeft")}
        >
          <AlignLeft className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          title={t("lessonEdit.blocks.toolbar.alignCenter")}
        >
          <AlignCenter className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          title={t("lessonEdit.blocks.toolbar.alignRight")}
        >
          <AlignRight className="size-4" />
        </ToolbarButton>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Image upload */}
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          title={t("lessonEdit.blocks.toolbar.addImage")}
        >
          <ImageIcon className="size-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileInputChange}
        />

        {/* Link */}
        <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title={t("lessonEdit.blocks.toolbar.addLink")}
              className={cn(
                "hover:bg-muted",
                editor.isActive("link") && "bg-muted text-foreground"
              )}
              onClick={() => {
                setLinkUrl(currentLink);
                setLinkPopoverOpen(true);
              }}
            >
              <LinkIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("lessonEdit.blocks.link.title")}
              </p>
              <Input
                placeholder={t("lessonEdit.blocks.link.placeholder")}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setLink();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={setLink}>
                  {t("lessonEdit.blocks.link.apply")}
                </Button>
                {editor.isActive("link") && (
                  <Button size="sm" variant="outline" onClick={removeLink}>
                    <Unlink className="size-4 mr-1" />
                    {t("common.remove")}
                  </Button>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Horizontal rule */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title={t("lessonEdit.blocks.toolbar.horizontalRule")}
        >
          <Minus className="size-4" />
        </ToolbarButton>
      </div>

      {/* Editor content - flex-1 to fill remaining height. cursor-text so
          the whole scroll area reads as editable, even when the
          .ProseMirror hasn't grown yet. */}
      <EditorContent
        editor={editor}
        className="flex-1 overflow-y-auto cursor-text"
      />
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn("hover:bg-muted", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}

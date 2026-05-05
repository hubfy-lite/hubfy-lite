import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FullscreenModal — componente base para TODOS os modais fullscreen.
 *
 * Animação padronizada (Opção A):
 *   Entrada: fade-in + scale 0.96→1, 200ms ease-out, origin center
 *   Saída:   fade-out + scale 1→0.98, 150ms ease-in
 *
 * Usa CSS keyframes customizados para evitar qualquer deslocamento lateral
 * herdado do tailwindcss-animate (zoom-in-95, slide-in-from-*, etc.).
 */

const FullscreenModal = DialogPrimitive.Root;
const FullscreenModalTrigger = DialogPrimitive.Trigger;
const FullscreenModalClose = DialogPrimitive.Close;

const FullscreenModalOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80",
      "data-[state=open]:animate-fs-overlay-in data-[state=closed]:animate-fs-overlay-out",
      className
    )}
    {...props}
  />
));
FullscreenModalOverlay.displayName = "FullscreenModalOverlay";

export interface FullscreenModalContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean;
}

const FullscreenModalContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  FullscreenModalContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <FullscreenModalOverlay />
    <DialogPrimitive.Content
      ref={ref}
      data-slot="fullscreen-modal-content"
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background",
        "data-[state=open]:animate-fs-content-in data-[state=closed]:animate-fs-content-out",
        className
      )}
      onCloseAutoFocus={(e) => {
        // Fix Radix bug: pointer-events stuck on body after closing Dialog
        // with nested Radix portals (Select, Popover, etc.)
        document.body.style.pointerEvents = "";
      }}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md p-1 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
FullscreenModalContent.displayName = "FullscreenModalContent";

const FullscreenModalTitle = DialogPrimitive.Title;
const FullscreenModalDescription = DialogPrimitive.Description;

export {
  FullscreenModal,
  FullscreenModalTrigger,
  FullscreenModalClose,
  FullscreenModalContent,
  FullscreenModalTitle,
  FullscreenModalDescription,
};

import type * as React from "react";

/** The console's button: shadcn's Button on Midway's tokens. One `default` (primary) per view. */
export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
  /** Render the child element (a link) with the button's classes. */
  asChild?: boolean;
}
export declare function Button(props: ButtonProps): React.ReactElement;

/** A single-line control. Wrap it in a Field. */
export interface InputProps extends React.ComponentProps<"input"> {}
export declare function Input(props: InputProps): React.ReactElement;

/** A labelled control; the error shows only after the user commits to a value (:user-invalid). */
export interface FieldProps {
  label: string;
  /** Shown above the control. */
  hint?: string;
  /** Shown under the control once it is invalid. */
  error: string;
  /** Exactly one control; Field sets its id, aria-describedby and aria-errormessage. */
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string; "aria-errormessage"?: string }>;
}
export declare function Field(props: FieldProps): React.ReactElement;

/** A form that keeps aria-invalid in step with native constraint validation. */
export interface ValidatedFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}
export declare function ValidatedForm(props: ValidatedFormProps): React.ReactElement;

/** A campaign's status as a painted plate. Unknown values render as draft. */
export interface StatusChipProps {
  status: "live" | "draft" | "ended" | (string & {});
}
export declare function StatusChip(props: StatusChipProps): React.ReactElement;

export interface Score {
  label: string;
  /** Pre-formatted: "2,418", "11.2%", or "—" with no plays. */
  value: React.ReactNode;
  note?: string;
}
/** Up to four numbers in one hairline panel. */
export interface ScoreStripProps {
  scores: Score[];
}
export declare function ScoreStrip(props: ScoreStripProps): React.ReactElement;

/** The sign-in and sign-up frame: enamel panel with the wordmark, form on the page ground. */
export interface AuthShellProps {
  title: string;
  intro: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}
export declare function AuthShell(props: AuthShellProps): React.ReactElement;

/** A panel sliding over the page from one edge (Radix Dialog). The console's mobile menu. */
export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  children?: React.ReactNode;
}
export declare function Sheet(props: SheetProps): React.ReactElement;
export declare function SheetTrigger(props: React.ComponentProps<"button"> & { asChild?: boolean }): React.ReactElement;
export declare function SheetClose(props: React.ComponentProps<"button"> & { asChild?: boolean }): React.ReactElement;
export interface SheetContentProps extends React.ComponentProps<"div"> {
  side?: "top" | "right" | "bottom" | "left";
  onOpenAutoFocus?: (event: Event) => void;
}
export declare function SheetContent(props: SheetContentProps): React.ReactElement;
export declare function SheetHeader(props: React.ComponentProps<"div">): React.ReactElement;
export declare function SheetFooter(props: React.ComponentProps<"div">): React.ReactElement;
/** Required for screen readers; sr-only when the content speaks for itself. */
export declare function SheetTitle(props: React.ComponentProps<"h2">): React.ReactElement;
export declare function SheetDescription(props: React.ComponentProps<"p">): React.ReactElement;

/** sonner's Toaster, themed with popover and border. Mount once, top right. */
export interface ToasterProps {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  expand?: boolean;
  duration?: number;
  closeButton?: boolean;
}
export declare function Toaster(props: ToasterProps): React.ReactElement;

export interface ToastOptions {
  description?: React.ReactNode;
  /** Milliseconds; Infinity keeps it open. */
  duration?: number;
  id?: string | number;
}
/** sonner's toast: toast.success("Campaign saved"), toast.error("That campaign could not be created."). */
export declare const toast: {
  (message: React.ReactNode, options?: ToastOptions): string | number;
  success(message: React.ReactNode, options?: ToastOptions): string | number;
  error(message: React.ReactNode, options?: ToastOptions): string | number;
  info(message: React.ReactNode, options?: ToastOptions): string | number;
  warning(message: React.ReactNode, options?: ToastOptions): string | number;
  dismiss(id?: string | number): void;
};

type Icon = React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
/** The lucide icons the console uses, at size-4 with aria-hidden beside a word. */
export declare const icons: Record<"Copy" | "Download" | "LayoutGrid" | "Menu" | "Monitor" | "Moon" | "Pencil" | "Plus" | "Store" | "Sun" | "Ticket" | "Trash2", Icon>;

declare global {
  interface Window {
    Midway: {
      Button: typeof Button;
      Input: typeof Input;
      Field: typeof Field;
      ValidatedForm: typeof ValidatedForm;
      StatusChip: typeof StatusChip;
      ScoreStrip: typeof ScoreStrip;
      AuthShell: typeof AuthShell;
      Sheet: typeof Sheet;
      SheetTrigger: typeof SheetTrigger;
      SheetClose: typeof SheetClose;
      SheetContent: typeof SheetContent;
      SheetHeader: typeof SheetHeader;
      SheetFooter: typeof SheetFooter;
      SheetTitle: typeof SheetTitle;
      SheetDescription: typeof SheetDescription;
      Toaster: typeof Toaster;
      toast: typeof toast;
      icons: typeof icons;
    };
  }
}

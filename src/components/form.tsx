import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  type FormHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";

type Controlish = {
  id?: string;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
};

/**
 * A labelled control.
 *
 * The visual error state is pure CSS (`:user-invalid`, so it appears only once
 * the user has committed to a value), but assistive tech needs the matching
 * programmatic state — hence the id wiring here and the aria-invalid sync in
 * `ValidatedForm`. `aria-errormessage` is ignored unless `aria-invalid="true"`.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error: string;
  children: ReactElement<Controlish>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className="field grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* Hints sit above the control so autofill popovers and mobile keyboards
          can't cover them mid-edit. */}
      {hint ? (
        <span id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </span>
      ) : null}
      {cloneElement(children, {
        id,
        "aria-describedby": hint ? hintId : undefined,
        "aria-errormessage": errorId,
      })}
      <span id={errorId} className="field-error">
        {error}
      </span>
    </div>
  );
}

/**
 * A form that keeps `aria-invalid` in step with native constraint validation.
 *
 * Browsers style `:user-invalid` on their own but never touch the ARIA state,
 * so without this a screen reader user gets no error at all. Flag on blur, then
 * keep updating as they type so a correction clears immediately.
 */
export function ValidatedForm({
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;

    const sync = (event: Event) => {
      const el = event.target as HTMLInputElement | null;
      if (!el || typeof el.checkValidity !== "function") return;
      // Only speak up once the field has been left at least once — mirroring
      // what :user-invalid does visually.
      if (event.type !== "blur" && !el.hasAttribute("aria-invalid")) return;
      el.setAttribute("aria-invalid", String(!el.checkValidity()));
    };

    form.addEventListener("blur", sync, true);
    form.addEventListener("input", sync, true);
    return () => {
      form.removeEventListener("blur", sync, true);
      form.removeEventListener("input", sync, true);
    };
  }, []);

  return (
    <form ref={ref} {...props}>
      {children}
    </form>
  );
}

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/common/DatePicker';
import { NativeSelect } from '@/components/common/NativeSelect';

const base =
  'min-h-[48px] w-full rounded-xl border border-border-app/60 bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-disabled focus:border-brand disabled:opacity-50';

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </label>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-danger">
      {message}
    </p>
  );
}

export function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const errorId = error ? `${fieldId}-error` : undefined;

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children as ReactElement<{ id?: string }>).props.id ?? fieldId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': errorId,
      })
    : children;

  return (
    <div>
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      {child}
      <FieldError message={error} id={errorId} />
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    if (type === 'date') {
      return <DatePicker ref={ref} className={className} {...props} />;
    }
    return <input ref={ref} type={type} className={cn(base, className)} {...props} />;
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, 'min-h-[80px] resize-y', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = NativeSelect;

/** Date field wired to react-hook-form `control` — use instead of `<Input type="date" {...register('date')} />`. */
export function FormDateInput<T extends FieldValues>({
  name,
  control,
  className,
  disabled,
}: {
  name: FieldPath<T>;
  control: Control<T>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <DatePicker
          className={className}
          disabled={disabled}
          name={field.name}
          value={field.value ?? ''}
          onChange={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
        />
      )}
    />
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
};

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-brand hover:bg-brand-hover active:bg-brand-active text-white',
    secondary: 'bg-surface hover:bg-surface-hover border border-border-app text-foreground',
    danger: 'bg-danger hover:bg-danger-hover text-white',
    ghost: 'text-muted hover:text-foreground hover:bg-surface-hover',
  };
  return (
    <button
      className={cn(
        'flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      gap={8}
      visibleToasts={3}
      duration={3200}
      toastOptions={{
        classNames: {
          toast:
            "group toast !border-0 !rounded-2xl !px-5 !py-4.5 min-h-[4.25rem] !text-sm !font-medium !shadow-none group-[.toaster]:bg-surface-container-high group-[.toaster]:text-foreground backdrop-blur-xl transition-all",
          description: "!text-xs !text-muted-foreground !font-normal",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground !rounded-full !text-xs !font-semibold",
          cancelButton: "group-[.toast]:bg-surface-container group-[.toast]:text-muted-foreground !rounded-full !text-xs",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
